"""Orquesta una corrida de scraping: usado tanto por el comando de cron como por el
endpoint de 'Buscar ahora'."""
from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.utils import timezone

from apps.fe import crypto
from apps.legacy.repositories import lic_repo
from apps.lic.models import ScrapeJob
from apps.lic.services.scraper import LicitacionesScraper, LoginError


def ejecutar_scrape(job: ScrapeJob, empresas: list[str]) -> None:
    resumen = {
        "oportunidades_nuevas": 0,
        "documentos_descargados": 0,
        "empresas_procesadas": [],
        "errores": {},
    }

    for no_cia in empresas:
        credencial = lic_repo.get_credencial_con_password(no_cia)
        if not credencial:
            resumen["errores"][no_cia] = "sin credencial configurada"
            continue

        try:
            password = crypto.decrypt(credencial["password_cifrado"])
            with LicitacionesScraper() as scraper:
                scraper.login(credencial["usuario_portal"], password)
                lic_repo.marcar_login_resultado(no_cia, ok=True)
                oportunidades = scraper.list_oportunidades()
                for data in oportunidades:
                    oportunidad_id, es_nueva = lic_repo.upsert_oportunidad(no_cia, data)
                    if not es_nueva:
                        continue
                    resumen["oportunidades_nuevas"] += 1
                    _descargar_y_guardar_documentos(
                        scraper, no_cia, data["referencia"], oportunidad_id, resumen
                    )
            resumen["empresas_procesadas"].append(no_cia)
        except LoginError as exc:
            lic_repo.marcar_login_resultado(no_cia, ok=False, mensaje_error=str(exc))
            resumen["errores"][no_cia] = str(exc)
        except Exception as exc:  # noqa: BLE001 - se registra y se sigue con las demás empresas
            resumen["errores"][no_cia] = str(exc)

    job.resumen = resumen
    job.estado = "completado_con_errores" if resumen["errores"] else "completado"
    job.terminado_en = timezone.now()
    job.save()


def _descargar_y_guardar_documentos(scraper, no_cia, referencia, oportunidad_id, resumen):
    """Descarga los documentos oficiales de una oportunidad recién descubierta y los
    persiste con ``lic_repo.guardar_documento``.

    ``LicitacionesScraper.download_documentos`` puede fallar por completo (referencia no
    encontrada en el feed, Aviso de Contrato sin sección de documentos, etc.) — ese caso se
    captura aquí para que un problema de documentos en una oportunidad no tumbe el resto de
    la corrida de la empresa.

    Cuando la descarga en sí funciona pero un documento puntual falla, ``download_documentos``
    ya lo reporta como una entrada con ``estado: "error"`` y ``tipo_documento``/
    ``nombre_archivo``/``ruta_archivo`` en ``None`` (ver docstring real en
    ``scraper.py::download_documentos``). ``NOMBRE_ARCHIVO`` y ``RUTA_ARCHIVO`` son
    ``NOT NULL`` en ``FAT.TLIC_DOCUMENTO`` (y Oracle trata `''` como NULL), así que esas
    entradas necesitan un valor de reemplazo no vacío para poder insertarse.
    """
    destino_dir = Path(settings.MEDIA_ROOT) / "lic" / no_cia / referencia
    try:
        documentos = scraper.download_documentos(referencia, destino_dir)
    except Exception as exc:  # noqa: BLE001 - un fallo de documentos no debe tumbar la empresa
        resumen["errores"][f"{no_cia}:{referencia}:documentos"] = str(exc)
        return
    for doc in documentos:
        estado = doc.get("estado", "ok")
        nombre_archivo = doc.get("nombre_archivo") or "(descarga fallida)"
        ruta_archivo = doc.get("ruta_archivo") or f"error: {doc.get('error', 'desconocido')}"
        lic_repo.guardar_documento(
            oportunidad_id,
            doc.get("tipo_documento"),
            nombre_archivo,
            ruta_archivo,
            estado=estado,
        )
        if estado == "ok":
            resumen["documentos_descargados"] += 1
