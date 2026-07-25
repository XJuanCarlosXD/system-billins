"""Orquesta una corrida de scraping: usado tanto por el comando de cron como por el
endpoint de 'Buscar ahora'."""
from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.utils import timezone

from apps.fe import crypto
from apps.legacy.repositories import lic_repo
from apps.lic.models import ScrapeJob
from apps.lic.services.analisis_licitacion import AnalisisError, ejecutar_analisis_oportunidad
from apps.lic.services.scraper import LicitacionesScraper, LoginError

# Tope de oportunidades SOLO descubiertas por Busqueda avanzada (no en el feed
# personalizado) que se intentan descargar+analizar por corrida y por empresa --
# cada una implica abrir una pestana nueva del Aviso de Contrato (10-30s), y el
# lote pendiente puede ser de cientos: sin tope, una sola corrida de "Buscar
# ahora" podria tardar horas. El resto del backlog se recoge en corridas
# siguientes (cron diario o nuevos clics en "Buscar ahora"), priorizando
# siempre las de fecha limite mas proxima (list_oportunidades ya ordena asi).
BACKFILL_BUSQUEDA_AVANZADA_LIMITE = 30


def ejecutar_scrape(job: ScrapeJob, empresas: list[str]) -> None:
    resumen = {
        "oportunidades_nuevas": 0,
        "documentos_descargados": 0,
        "empresas_procesadas": [],
        "errores": [],
    }

    _descubrir_via_busqueda_avanzada(empresas, resumen)

    for no_cia in empresas:
        credencial = lic_repo.get_credencial_con_password(no_cia)
        if not credencial:
            _agregar_error(resumen, no_cia, "sin credencial configurada", contexto="credencial")
            continue

        try:
            password = crypto.decrypt(credencial["password_cifrado"])
            with LicitacionesScraper() as scraper:
                scraper.login(credencial["usuario_portal"], password)
                lic_repo.marcar_login_resultado(no_cia, ok=True)
                oportunidades = scraper.list_oportunidades()
                for data in oportunidades:
                    oportunidad_id, es_nueva = lic_repo.upsert_oportunidad(no_cia, data)
                    # Una oportunidad ya vista se reintenta igual si quedó sin documentos
                    # registrados (p.ej. download_documentos lanzó una excepción completa
                    # en su primera pasada) -- de lo contrario nunca más se reintentaría.
                    if not es_nueva and lic_repo.tiene_documentos(oportunidad_id):
                        continue
                    if es_nueva:
                        resumen["oportunidades_nuevas"] += 1
                    _descargar_y_guardar_documentos(
                        scraper, no_cia, data["referencia"], oportunidad_id, resumen
                    )
                    # El análisis con IA (resumen, requisitos, evaluación contra los
                    # documentos de la empresa) se genera aquí, apenas se descargan los
                    # documentos -- así el usuario ya lo ve listo al abrir el detalle en
                    # el frontend, en vez de esperar una llamada a la IA en ese momento.
                    # El botón "Volver a analizar" del frontend sigue existiendo para
                    # re-correrlo a mano (p.ej. después de subir un documento nuevo de la
                    # empresa), pero el flujo normal no depende de él.
                    _analizar_y_registrar(no_cia, data["referencia"], oportunidad_id, resumen)

                # Backfill acotado: oportunidades que SOLO trajo la Busqueda avanzada
                # (Parte A) -- el bucle de arriba ya cubrio las del feed personalizado,
                # pero buscar_avanzada() solo hace upsert (Task 3), nunca descarga
                # documentos ni analiza. Sin este paso quedarian vacias para siempre,
                # aunque el usuario abra su detalle -- reusa la MISMA sesion ya logueada.
                _backfill_busqueda_avanzada(scraper, no_cia, resumen)
            resumen["empresas_procesadas"].append(no_cia)
        except LoginError as exc:
            lic_repo.marcar_login_resultado(no_cia, ok=False, mensaje_error=str(exc))
            _agregar_error(resumen, no_cia, str(exc), contexto="login")
        except Exception as exc:  # noqa: BLE001 - se registra y se sigue con las demás empresas
            _agregar_error(resumen, no_cia, str(exc), contexto="empresa")

    job.resumen = resumen
    job.estado = "completado_con_errores" if resumen["errores"] else "completado"
    job.terminado_en = timezone.now()
    job.save()


def _descubrir_via_busqueda_avanzada(empresas: list[str], resumen: dict) -> None:
    """Corre UNA sola vez por corrida (no depende de credenciales -- la Búsqueda
    avanzada es pública) y hace upsert de las oportunidades encontradas para
    CADA empresa de ``empresas``: las licitaciones públicas aplican por igual a
    todas las empresas del grupo, el filtrado por aplicabilidad real lo hace el
    análisis de IA por empresa más adelante, no el descubrimiento. Un fallo acá
    (portal caído, cambio de layout) se registra como error aislado y NO
    bloquea el resto de la corrida -- el feed autenticado por empresa sigue
    corriendo igual como respaldo."""
    try:
        with LicitacionesScraper() as scraper:
            oportunidades = scraper.buscar_avanzada(status="Published", tope=1000)
    except Exception as exc:  # noqa: BLE001 - fallo aislado, no debe tumbar la corrida
        _agregar_error(resumen, "*", str(exc), contexto="busqueda_avanzada")
        return

    for no_cia in empresas:
        for data in oportunidades:
            lic_repo.upsert_oportunidad(no_cia, data)


def _backfill_busqueda_avanzada(scraper, no_cia: str, resumen: dict) -> None:
    """Descarga documentos + analiza con IA las oportunidades de ``no_cia`` que
    ya existen en TLIC_OPORTUNIDAD (por venir de buscar_avanzada, Task 3) pero
    todavia no tienen documentos -- hasta ``BACKFILL_BUSQUEDA_AVANZADA_LIMITE``
    por corrida, priorizando fecha limite mas proxima.

    Usa ``scraper.descargar_documentos_publico`` (modal "Detail" PUBLICO de
    la Busqueda avanzada, sin login) en vez de ``download_documentos``
    (requiere encontrar la referencia en el feed AUTENTICADO de la empresa).
    Verificado en vivo el 2026-07-25: la gran mayoria de lo que descubre
    buscar_avanzada NO aparece en el feed autenticado de ninguna empresa
    (DGCP solo lo matchea ahi si coincide con un rubro RPE registrado) -- el
    intento original de reusar ``_descargar_y_guardar_documentos`` fallaba
    100% de las veces por esto mismo. El camino publico no depende de rubro
    ni de credenciales, cubre cualquier oportunidad publicada."""
    pendientes = [
        o for o in lic_repo.list_oportunidades(no_cia, solo_abiertas=True)
        if not lic_repo.tiene_documentos(o["id"])
    ][:BACKFILL_BUSQUEDA_AVANZADA_LIMITE]

    for o in pendientes:
        _descargar_y_guardar_documentos_publico(scraper, no_cia, o["referencia"], o["id"], resumen)
        _analizar_y_registrar(no_cia, o["referencia"], o["id"], resumen)


def _descargar_y_guardar_documentos_publico(scraper, no_cia, referencia, oportunidad_id, resumen):
    """Igual que ``_descargar_y_guardar_documentos`` pero via el modal publico
    de la Busqueda avanzada (``scraper.descargar_documentos_publico``, sin
    login) -- usado por el backfill de oportunidades que no aparecen en el
    feed autenticado de ninguna empresa. Mismo criterio de aislamiento de
    errores documentado en ``_descargar_y_guardar_documentos``."""
    destino_dir = Path(settings.MEDIA_ROOT) / "lic" / no_cia / referencia
    try:
        resultado = scraper.descargar_documentos_publico(referencia, destino_dir)
    except Exception as exc:  # noqa: BLE001 - un fallo de documentos no debe tumbar la empresa
        _agregar_error(resumen, no_cia, str(exc), referencia=referencia, contexto="documentos")
        return

    documentos = resultado["documentos"]
    detalle = resultado["detalle"]
    if any(v for k, v in detalle.items() if k != "productos"):
        lic_repo.actualizar_detalle_oportunidad(oportunidad_id, detalle)
    if detalle.get("productos"):
        lic_repo.reemplazar_productos(oportunidad_id, detalle["productos"])

    for doc in documentos:
        estado = doc.get("estado", "ok")
        nombre_archivo = doc.get("nombre_archivo") or "(descarga fallida)"
        ruta_archivo = doc.get("ruta_archivo") or "(descarga fallida)"
        mensaje_error = doc.get("error") if estado == "error" else None
        try:
            lic_repo.guardar_documento(
                oportunidad_id, doc.get("tipo_documento"), nombre_archivo, ruta_archivo,
                estado=estado, mensaje_error=mensaje_error,
            )
        except Exception as exc:  # noqa: BLE001 - un documento no debe tumbar los demás
            _agregar_error(resumen, no_cia, str(exc), referencia=referencia, contexto="persistencia")
            continue
        if estado == "ok":
            resumen["documentos_descargados"] += 1


def _agregar_error(resumen: dict, no_cia: str, mensaje: str, *,
                    referencia: str | None = None, contexto: str) -> None:
    """Registra un error en forma estructurada (no como texto concatenado) para que
    consumidores como el endpoint de status (Task 13) puedan filtrar/mostrar sin parsear
    strings — y para no romper si ``no_cia`` o ``referencia`` alguna vez trajeran ':'."""
    resumen["errores"].append({
        "no_cia": no_cia,
        "referencia": referencia,
        "contexto": contexto,
        "mensaje": mensaje,
    })


def _analizar_y_registrar(no_cia: str, referencia: str, oportunidad_id: int, resumen: dict) -> None:
    """Corre el análisis con IA para una oportunidad recién procesada. Un fallo
    acá (sin documentos con texto extraíble, error real de la API de Claude)
    se registra como un error más de la corrida pero NO debe tumbar el resto
    del scraping -- la oportunidad y sus documentos ya quedaron guardados de
    todas formas, el análisis se puede reintentar luego a mano."""
    try:
        ejecutar_analisis_oportunidad(oportunidad_id)
    except AnalisisError as exc:
        _agregar_error(resumen, no_cia, str(exc), referencia=referencia, contexto="analisis")
    except Exception as exc:  # noqa: BLE001 - fallo real de la API, mismo criterio
        _agregar_error(resumen, no_cia, str(exc), referencia=referencia, contexto="analisis")


def _descargar_y_guardar_documentos(scraper, no_cia, referencia, oportunidad_id, resumen):
    """Descarga los documentos oficiales de una oportunidad y los persiste con
    ``lic_repo.guardar_documento``.

    Dos niveles de fallo se aíslan por separado:

    1. ``LicitacionesScraper.download_documentos`` puede fallar por completo (referencia no
       encontrada en el feed, Aviso de Contrato sin sección de documentos, etc.) — se
       captura aquí para que un problema de documentos en una oportunidad no tumbe el resto
       de la corrida de la empresa. La oportunidad queda sin filas en TLIC_DOCUMENTO, así
       que ``lic_repo.tiene_documentos`` la marcará para reintento en la próxima corrida
       aunque ya no sea "nueva".
    2. Cuando la descarga en sí funciona pero un documento puntual falla,
       ``download_documentos`` ya lo reporta como una entrada con ``estado: "error"`` y
       ``tipo_documento``/``nombre_archivo``/``ruta_archivo`` en ``None`` (ver docstring
       real en ``scraper.py::download_documentos``); el mensaje de error real se guarda en
       la columna ``MENSAJE_ERROR`` (agregada a ``FAT.TLIC_DOCUMENTO`` para esto, ver
       ``apps/lic/sql/001_create_tlic.sql``) en vez de sobrecargar ``RUTA_ARCHIVO`` (que es
       VARCHAR2(500) y NOT NULL -- y Oracle trata '' como NULL, así que ambos campos usan un
       placeholder corto no vacío). Además, cada llamada a ``guardar_documento`` tiene su
       propio try/except: si persistir el documento N falla (p.ej. ORA-12899 truncando un
       valor), los documentos N+1..final de la misma oportunidad se siguen intentando en vez
       de abortar toda la función y saltarse silenciosamente el resto.
    """
    destino_dir = Path(settings.MEDIA_ROOT) / "lic" / no_cia / referencia
    try:
        resultado = scraper.download_documentos(referencia, destino_dir)
    except Exception as exc:  # noqa: BLE001 - un fallo de documentos no debe tumbar la empresa
        _agregar_error(resumen, no_cia, str(exc), referencia=referencia, contexto="documentos")
        return

    documentos = resultado["documentos"]
    detalle = resultado["detalle"]
    if any(v for k, v in detalle.items() if k != "productos"):
        # Datos que el portal ya expone directamente en el Aviso de Contrato
        # (descripción completa, unidad de requisición, presupuesto,
        # modalidad de entrega) -- no necesitan IA, se guardan tal cual se
        # leen. Un campo faltante (varía según el tipo de proceso) simplemente
        # no se actualiza. "productos" se excluye de este chequeo porque va a
        # su propia tabla (TLIC_PRODUCTO), no a columnas de TLIC_OPORTUNIDAD.
        lic_repo.actualizar_detalle_oportunidad(oportunidad_id, detalle)
    if detalle.get("productos"):
        lic_repo.reemplazar_productos(oportunidad_id, detalle["productos"])

    for doc in documentos:
        estado = doc.get("estado", "ok")
        nombre_archivo = doc.get("nombre_archivo") or "(descarga fallida)"
        ruta_archivo = doc.get("ruta_archivo") or "(descarga fallida)"
        mensaje_error = doc.get("error") if estado == "error" else None
        try:
            lic_repo.guardar_documento(
                oportunidad_id,
                doc.get("tipo_documento"),
                nombre_archivo,
                ruta_archivo,
                estado=estado,
                mensaje_error=mensaje_error,
            )
        except Exception as exc:  # noqa: BLE001 - un documento no debe tumbar los demás
            _agregar_error(
                resumen, no_cia, str(exc), referencia=referencia, contexto="persistencia"
            )
            continue
        if estado == "ok":
            resumen["documentos_descargados"] += 1
