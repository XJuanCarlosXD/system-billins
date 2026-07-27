from unittest.mock import ANY, MagicMock, patch

from apps.lic.models import ScrapeJob
from apps.lic.services.orchestrator import ejecutar_scrape
import pytest


@pytest.mark.django_db
def test_ejecutar_scrape_marks_job_completado_when_no_errors():
    job = ScrapeJob.objects.create(trigger="manual", no_cia="01")
    credencial = {"no_cia": "01", "usuario_portal": "abregonza", "password_cifrado": "x"}

    with patch("apps.lic.services.orchestrator.lic_repo") as repo, \
         patch("apps.lic.services.orchestrator.crypto") as crypto, \
         patch("apps.lic.services.orchestrator.LicitacionesScraper") as ScraperCls, \
         patch("apps.lic.services.orchestrator.ejecutar_analisis_oportunidad"):
        repo.get_credencial_con_password.return_value = credencial
        crypto.decrypt.return_value = "plain-password"
        repo.upsert_oportunidad.return_value = (1, True)
        repo.list_oportunidades.return_value = {"oportunidades": [], "total": 0}  # backfill de Busqueda avanzada: no-op
        scraper_instance = MagicMock()
        scraper_instance.buscar_avanzada.return_value = []
        scraper_instance.list_oportunidades.return_value = [
            {"referencia": "REF-1", "titulo": "algo"}
        ]
        scraper_instance.download_documentos.return_value = {
            "documentos": [
                {"tipo_documento": "Pliego", "nombre_archivo": "pliego.pdf", "ruta_archivo": "/x/pliego.pdf", "estado": "ok"}
            ],
            "detalle": {},
        }
        ScraperCls.return_value.__enter__.return_value = scraper_instance

        ejecutar_scrape(job, empresas=["01"])

    job.refresh_from_db()
    assert job.estado == "completado"
    assert job.resumen["oportunidades_nuevas"] == 1
    assert job.resumen["documentos_descargados"] == 1
    assert job.resumen["errores"] == []
    repo.guardar_documento.assert_called_once_with(
        1, "Pliego", "pliego.pdf", "/x/pliego.pdf", estado="ok", mensaje_error=None
    )


@pytest.mark.django_db
def test_ejecutar_scrape_marks_job_con_errores_when_login_fails():
    job = ScrapeJob.objects.create(trigger="manual", no_cia="01")
    credencial = {"no_cia": "01", "usuario_portal": "abregonza", "password_cifrado": "x"}

    with patch("apps.lic.services.orchestrator.lic_repo") as repo, \
         patch("apps.lic.services.orchestrator.crypto") as crypto, \
         patch("apps.lic.services.orchestrator.LicitacionesScraper") as ScraperCls:
        repo.get_credencial_con_password.return_value = credencial
        crypto.decrypt.return_value = "plain-password"
        scraper_instance = MagicMock()
        from apps.lic.services.scraper import LoginError
        scraper_instance.login.side_effect = LoginError("credenciales invalidas")
        ScraperCls.return_value.__enter__.return_value = scraper_instance

        ejecutar_scrape(job, empresas=["01"])

    job.refresh_from_db()
    assert job.estado == "completado_con_errores"
    errores = job.resumen["errores"]
    assert isinstance(errores, list)
    assert any(
        e["no_cia"] == "01" and e["referencia"] is None and e["contexto"] == "login"
        and e["mensaje"] == "credenciales invalidas"
        for e in errores
    )


@pytest.mark.django_db
def test_ejecutar_scrape_marks_job_con_errores_when_credencial_missing():
    job = ScrapeJob.objects.create(trigger="manual", no_cia="01")

    with patch("apps.lic.services.orchestrator.lic_repo") as repo, \
         patch("apps.lic.services.orchestrator.crypto"), \
         patch("apps.lic.services.orchestrator.LicitacionesScraper"):
        repo.get_credencial_con_password.return_value = None

        ejecutar_scrape(job, empresas=["01"])

    job.refresh_from_db()
    assert job.estado == "completado_con_errores"
    errores = job.resumen["errores"]
    assert any(
        e["no_cia"] == "01" and e["contexto"] == "credencial"
        and e["mensaje"] == "sin credencial configurada"
        for e in errores
    )


@pytest.mark.django_db
def test_ejecutar_scrape_does_not_download_documents_for_existing_oportunidad_con_documentos():
    """Solo se descargan documentos para oportunidades NUEVAS o para oportunidades ya
    vistas que aún no tienen ningún documento guardado."""
    job = ScrapeJob.objects.create(trigger="manual", no_cia="01")
    credencial = {"no_cia": "01", "usuario_portal": "abregonza", "password_cifrado": "x"}

    with patch("apps.lic.services.orchestrator.lic_repo") as repo, \
         patch("apps.lic.services.orchestrator.crypto") as crypto, \
         patch("apps.lic.services.orchestrator.LicitacionesScraper") as ScraperCls:
        repo.get_credencial_con_password.return_value = credencial
        crypto.decrypt.return_value = "plain-password"
        repo.upsert_oportunidad.return_value = (1, False)  # ya existía
        repo.tiene_documentos.return_value = True  # y ya tiene documentos guardados
        repo.list_oportunidades.return_value = {"oportunidades": [], "total": 0}  # backfill de Busqueda avanzada: no-op
        scraper_instance = MagicMock()
        scraper_instance.list_oportunidades.return_value = [
            {"referencia": "REF-1", "titulo": "algo"}
        ]
        ScraperCls.return_value.__enter__.return_value = scraper_instance

        ejecutar_scrape(job, empresas=["01"])

    scraper_instance.download_documentos.assert_not_called()
    job.refresh_from_db()
    assert job.resumen["oportunidades_nuevas"] == 0
    assert job.resumen["documentos_descargados"] == 0


@pytest.mark.django_db
def test_ejecutar_scrape_retries_documents_for_previously_seen_oportunidad_without_documents():
    """Si en una pasada anterior download_documentos falló por completo (excepción, no una
    fila individual), la oportunidad queda sin filas en TLIC_DOCUMENTO aunque ya no sea
    "nueva" -- la siguiente corrida debe reintentar la descarga."""
    job = ScrapeJob.objects.create(trigger="manual", no_cia="01")
    credencial = {"no_cia": "01", "usuario_portal": "abregonza", "password_cifrado": "x"}

    with patch("apps.lic.services.orchestrator.lic_repo") as repo, \
         patch("apps.lic.services.orchestrator.crypto") as crypto, \
         patch("apps.lic.services.orchestrator.LicitacionesScraper") as ScraperCls:
        repo.get_credencial_con_password.return_value = credencial
        crypto.decrypt.return_value = "plain-password"
        repo.upsert_oportunidad.return_value = (1, False)  # ya vista antes
        repo.tiene_documentos.return_value = False  # pero sin documentos guardados
        repo.list_oportunidades.return_value = {"oportunidades": [], "total": 0}  # backfill de Busqueda avanzada: no-op
        scraper_instance = MagicMock()
        scraper_instance.list_oportunidades.return_value = [
            {"referencia": "REF-1", "titulo": "algo"}
        ]
        scraper_instance.download_documentos.return_value = {
            "documentos": [
                {"tipo_documento": "Pliego", "nombre_archivo": "pliego.pdf", "ruta_archivo": "/x/pliego.pdf", "estado": "ok"}
            ],
            "detalle": {},
        }
        ScraperCls.return_value.__enter__.return_value = scraper_instance

        ejecutar_scrape(job, empresas=["01"])

    scraper_instance.download_documentos.assert_called_once()
    job.refresh_from_db()
    assert job.resumen["oportunidades_nuevas"] == 0  # no era nueva
    assert job.resumen["documentos_descargados"] == 1  # pero se reintentó con éxito


@pytest.mark.django_db
def test_ejecutar_scrape_continues_when_document_download_fails():
    """Un fallo al descargar documentos de UNA oportunidad no debe tumbar toda la corrida."""
    job = ScrapeJob.objects.create(trigger="manual", no_cia="01")
    credencial = {"no_cia": "01", "usuario_portal": "abregonza", "password_cifrado": "x"}

    with patch("apps.lic.services.orchestrator.lic_repo") as repo, \
         patch("apps.lic.services.orchestrator.crypto") as crypto, \
         patch("apps.lic.services.orchestrator.LicitacionesScraper") as ScraperCls:
        repo.get_credencial_con_password.return_value = credencial
        crypto.decrypt.return_value = "plain-password"
        repo.upsert_oportunidad.return_value = (1, True)
        repo.list_oportunidades.return_value = {"oportunidades": [], "total": 0}  # backfill de Busqueda avanzada: no-op
        scraper_instance = MagicMock()
        scraper_instance.list_oportunidades.return_value = [
            {"referencia": "REF-1", "titulo": "algo"}
        ]
        scraper_instance.download_documentos.side_effect = RuntimeError("timeout de red")
        ScraperCls.return_value.__enter__.return_value = scraper_instance

        ejecutar_scrape(job, empresas=["01"])

    job.refresh_from_db()
    # La oportunidad SÍ se registró como nueva; el fallo de documentos queda en errores pero
    # no bloquea el resto de la corrida (aquí "el resto" es solo esta empresa/oportunidad,
    # pero el punto es que el job completa, no explota).
    assert job.resumen["oportunidades_nuevas"] == 1
    assert job.estado == "completado_con_errores"
    errores = job.resumen["errores"]
    assert any(
        e["no_cia"] == "01" and e["referencia"] == "REF-1" and e["contexto"] == "documentos"
        and e["mensaje"] == "timeout de red"
        for e in errores
    )


@pytest.mark.django_db
def test_ejecutar_scrape_uses_placeholder_and_mensaje_error_for_failed_document_entry():
    """Una entrada de documento individual con estado='error' trae nombre/ruta en None
    (ver scraper.py::download_documentos); NOMBRE_ARCHIVO y RUTA_ARCHIVO son NOT NULL en
    Oracle (y '' se trata como NULL), así que se sustituyen por un placeholder no vacío, y
    el mensaje real del error se pasa por separado a la columna MENSAJE_ERROR."""
    job = ScrapeJob.objects.create(trigger="manual", no_cia="01")
    credencial = {"no_cia": "01", "usuario_portal": "abregonza", "password_cifrado": "x"}

    with patch("apps.lic.services.orchestrator.lic_repo") as repo, \
         patch("apps.lic.services.orchestrator.crypto") as crypto, \
         patch("apps.lic.services.orchestrator.LicitacionesScraper") as ScraperCls:
        repo.get_credencial_con_password.return_value = credencial
        crypto.decrypt.return_value = "plain-password"
        repo.upsert_oportunidad.return_value = (1, True)
        repo.list_oportunidades.return_value = {"oportunidades": [], "total": 0}  # backfill de Busqueda avanzada: no-op
        scraper_instance = MagicMock()
        scraper_instance.list_oportunidades.return_value = [
            {"referencia": "REF-1", "titulo": "algo"}
        ]
        scraper_instance.download_documentos.return_value = {
            "documentos": [
                {
                    "tipo_documento": None,
                    "nombre_archivo": None,
                    "ruta_archivo": None,
                    "estado": "error",
                    "error": "descarga fallida",
                }
            ],
            "detalle": {},
        }
        ScraperCls.return_value.__enter__.return_value = scraper_instance

        ejecutar_scrape(job, empresas=["01"])

    job.refresh_from_db()
    assert job.resumen["documentos_descargados"] == 0
    args, kwargs = repo.guardar_documento.call_args
    assert args[2]  # nombre_archivo no vacío (placeholder)
    assert args[3]  # ruta_archivo no vacío (placeholder)
    assert kwargs["estado"] == "error"
    assert kwargs["mensaje_error"] == "descarga fallida"


@pytest.mark.django_db
def test_ejecutar_scrape_continues_when_guardar_documento_fails_for_one_document():
    """Un fallo al PERSISTIR un documento puntual (p.ej. ORA-12899) no debe abortar el
    resto de los documentos de la misma oportunidad ni saltarse silenciosamente el resto
    de la corrida de la empresa."""
    job = ScrapeJob.objects.create(trigger="manual", no_cia="01")
    credencial = {"no_cia": "01", "usuario_portal": "abregonza", "password_cifrado": "x"}

    with patch("apps.lic.services.orchestrator.lic_repo") as repo, \
         patch("apps.lic.services.orchestrator.crypto") as crypto, \
         patch("apps.lic.services.orchestrator.LicitacionesScraper") as ScraperCls:
        repo.get_credencial_con_password.return_value = credencial
        crypto.decrypt.return_value = "plain-password"
        repo.upsert_oportunidad.return_value = (1, True)
        repo.guardar_documento.side_effect = [RuntimeError("ORA-12899"), None]
        repo.list_oportunidades.return_value = {"oportunidades": [], "total": 0}  # backfill de Busqueda avanzada: no-op
        scraper_instance = MagicMock()
        scraper_instance.list_oportunidades.return_value = [
            {"referencia": "REF-1", "titulo": "algo"}
        ]
        scraper_instance.download_documentos.return_value = {
            "documentos": [
                {"tipo_documento": "Pliego", "nombre_archivo": "pliego.pdf", "ruta_archivo": "/x/pliego.pdf", "estado": "ok"},
                {"tipo_documento": "Anexo", "nombre_archivo": "anexo.pdf", "ruta_archivo": "/x/anexo.pdf", "estado": "ok"},
            ],
            "detalle": {},
        }
        ScraperCls.return_value.__enter__.return_value = scraper_instance

        ejecutar_scrape(job, empresas=["01"])

    job.refresh_from_db()
    assert repo.guardar_documento.call_count == 2  # se intentó con ambos documentos
    assert job.resumen["documentos_descargados"] == 1  # solo el segundo se contó
    errores = job.resumen["errores"]
    assert any(
        e["no_cia"] == "01" and e["referencia"] == "REF-1" and e["contexto"] == "persistencia"
        and e["mensaje"] == "ORA-12899"
        for e in errores
    )
    assert job.estado == "completado_con_errores"


@pytest.mark.django_db
def test_ejecutar_scrape_descubre_via_busqueda_avanzada_antes_del_login_por_empresa():
    """La busqueda avanzada publica corre UNA vez por corrida (no depende de
    credenciales) y hace upsert para cada empresa activa antes de procesar
    login/documentos por empresa."""
    job = ScrapeJob.objects.create(trigger="manual", no_cia=None)
    credencial = {"no_cia": "01", "usuario_portal": "abregonza", "password_cifrado": "x"}

    with patch("apps.lic.services.orchestrator.lic_repo") as repo, \
         patch("apps.lic.services.orchestrator.crypto") as crypto, \
         patch("apps.lic.services.orchestrator.LicitacionesScraper") as ScraperCls:
        repo.get_credencial_con_password.return_value = credencial
        crypto.decrypt.return_value = "plain-password"
        repo.upsert_oportunidad.return_value = (1, True)
        repo.tiene_documentos.return_value = True  # ya tiene documentos, no reintenta descarga
        repo.list_oportunidades.return_value = {"oportunidades": [], "total": 0}  # backfill de Busqueda avanzada: no-op
        scraper_instance = MagicMock()
        scraper_instance.buscar_avanzada.return_value = [
            {"referencia": "PUB-1", "entidad": "Ministerio X", "titulo": "algo",
             "estado_portal": "Published", "fecha_publicacion": "2026-07-24 09:00",
             "fecha_limite": "2026-07-30 09:00", "presupuesto_estimado": "100,000 Dominican Pesos"}
        ]
        scraper_instance.list_oportunidades.return_value = []
        ScraperCls.return_value.__enter__.return_value = scraper_instance

        ejecutar_scrape(job, empresas=["01"])

    scraper_instance.buscar_avanzada.assert_called_once_with(status="Published", tope=1000)
    repo.upsert_oportunidad.assert_any_call("01", scraper_instance.buscar_avanzada.return_value[0])
    job.refresh_from_db()
    assert job.resumen["errores"] == []


@pytest.mark.django_db
def test_ejecutar_scrape_continua_si_busqueda_avanzada_falla():
    """Un fallo en la busqueda avanzada publica (portal caido, cambio de layout) no debe
    tumbar el resto de la corrida -- se registra como error aislado y se sigue con el
    feed autenticado normal."""
    job = ScrapeJob.objects.create(trigger="manual", no_cia="01")
    credencial = {"no_cia": "01", "usuario_portal": "abregonza", "password_cifrado": "x"}

    with patch("apps.lic.services.orchestrator.lic_repo") as repo, \
         patch("apps.lic.services.orchestrator.crypto") as crypto, \
         patch("apps.lic.services.orchestrator.LicitacionesScraper") as ScraperCls:
        repo.get_credencial_con_password.return_value = credencial
        crypto.decrypt.return_value = "plain-password"
        scraper_instance = MagicMock()
        scraper_instance.buscar_avanzada.side_effect = RuntimeError("selector no encontrado")
        scraper_instance.list_oportunidades.return_value = []
        ScraperCls.return_value.__enter__.return_value = scraper_instance

        ejecutar_scrape(job, empresas=["01"])

    job.refresh_from_db()
    assert job.estado == "completado_con_errores"
    errores = job.resumen["errores"]
    assert any(
        e["contexto"] == "busqueda_avanzada" and e["mensaje"] == "selector no encontrado"
        for e in errores
    )


@pytest.mark.django_db
def test_ejecutar_scrape_guarda_productos_extraidos_por_el_scraper():
    job = ScrapeJob.objects.create(trigger="manual", no_cia="01")
    credencial = {"no_cia": "01", "usuario_portal": "abregonza", "password_cifrado": "x"}

    with patch("apps.lic.services.orchestrator.lic_repo") as repo, \
         patch("apps.lic.services.orchestrator.crypto") as crypto, \
         patch("apps.lic.services.orchestrator.LicitacionesScraper") as ScraperCls, \
         patch("apps.lic.services.orchestrator.ejecutar_analisis_oportunidad"):
        repo.get_credencial_con_password.return_value = credencial
        crypto.decrypt.return_value = "plain-password"
        repo.upsert_oportunidad.return_value = (1, True)
        repo.list_oportunidades.return_value = {"oportunidades": [], "total": 0}  # backfill de Busqueda avanzada: no-op
        scraper_instance = MagicMock()
        scraper_instance.buscar_avanzada.return_value = []
        scraper_instance.list_oportunidades.return_value = [{"referencia": "REF-1", "titulo": "algo"}]
        scraper_instance.download_documentos.return_value = {
            "documentos": [],
            "detalle": {"productos": [{"descripcion": "100 laptops", "cantidad": "100"}]},
        }
        ScraperCls.return_value.__enter__.return_value = scraper_instance

        ejecutar_scrape(job, empresas=["01"])

    repo.reemplazar_productos.assert_called_once_with(
        1, [{"descripcion": "100 laptops", "cantidad": "100"}]
    )


@pytest.mark.django_db
def test_ejecutar_scrape_backfill_descarga_y_analiza_oportunidades_de_busqueda_avanzada():
    """Las oportunidades que SOLO trajo buscar_avanzada (Task 3) quedan en TLIC_OPORTUNIDAD
    sin documentos ni analisis -- el backfill debe intentar descargarlas/analizarlas
    tambien, reutilizando la misma sesion ya logueada, no solo las del feed personalizado."""
    job = ScrapeJob.objects.create(trigger="manual", no_cia="01")
    credencial = {"no_cia": "01", "usuario_portal": "abregonza", "password_cifrado": "x"}

    with patch("apps.lic.services.orchestrator.lic_repo") as repo, \
         patch("apps.lic.services.orchestrator.crypto") as crypto, \
         patch("apps.lic.services.orchestrator.LicitacionesScraper") as ScraperCls, \
         patch("apps.lic.services.orchestrator.ejecutar_analisis_oportunidad"):
        repo.get_credencial_con_password.return_value = credencial
        crypto.decrypt.return_value = "plain-password"
        repo.upsert_oportunidad.return_value = (1, True)
        repo.tiene_documentos.return_value = False
        repo.list_oportunidades.return_value = {
            "oportunidades": [{"id": 42, "referencia": "PUB-1", "titulo": "algo"}],
            "total": 1,
        }
        scraper_instance = MagicMock()
        scraper_instance.buscar_avanzada.return_value = []
        scraper_instance.list_oportunidades.return_value = []  # nada en el feed personalizado
        scraper_instance.descargar_documentos_publico.return_value = {
            "documentos": [
                {"tipo_documento": "Pliego", "nombre_archivo": "p.pdf", "ruta_archivo": "/x/p.pdf", "estado": "ok"}
            ],
            "detalle": {},
        }
        ScraperCls.return_value.__enter__.return_value = scraper_instance

        ejecutar_scrape(job, empresas=["01"])

    scraper_instance.descargar_documentos_publico.assert_called_once_with("PUB-1", ANY)
    job.refresh_from_db()
    assert job.resumen["documentos_descargados"] == 1


@pytest.mark.django_db
def test_ejecutar_scrape_backfill_respeta_el_tope_por_corrida():
    """No debe intentar descargar mas de BACKFILL_BUSQUEDA_AVANZADA_LIMITE oportunidades
    de Busqueda avanzada por corrida -- el resto queda para la proxima."""
    from apps.lic.services.orchestrator import BACKFILL_BUSQUEDA_AVANZADA_LIMITE

    job = ScrapeJob.objects.create(trigger="manual", no_cia="01")
    credencial = {"no_cia": "01", "usuario_portal": "abregonza", "password_cifrado": "x"}

    with patch("apps.lic.services.orchestrator.lic_repo") as repo, \
         patch("apps.lic.services.orchestrator.crypto") as crypto, \
         patch("apps.lic.services.orchestrator.LicitacionesScraper") as ScraperCls, \
         patch("apps.lic.services.orchestrator.ejecutar_analisis_oportunidad"):
        repo.get_credencial_con_password.return_value = credencial
        crypto.decrypt.return_value = "plain-password"
        repo.tiene_documentos.return_value = False
        oportunidades_backlog = [
            {"id": i, "referencia": f"PUB-{i}", "titulo": "algo"}
            for i in range(BACKFILL_BUSQUEDA_AVANZADA_LIMITE + 10)
        ]
        repo.list_oportunidades.return_value = {
            "oportunidades": oportunidades_backlog, "total": len(oportunidades_backlog),
        }
        scraper_instance = MagicMock()
        scraper_instance.buscar_avanzada.return_value = []
        scraper_instance.list_oportunidades.return_value = []
        scraper_instance.descargar_documentos_publico.return_value = {"documentos": [], "detalle": {}}
        ScraperCls.return_value.__enter__.return_value = scraper_instance

        ejecutar_scrape(job, empresas=["01"])

    assert scraper_instance.descargar_documentos_publico.call_count == BACKFILL_BUSQUEDA_AVANZADA_LIMITE
