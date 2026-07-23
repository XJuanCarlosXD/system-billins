from unittest.mock import MagicMock, patch

from apps.lic.models import ScrapeJob
from apps.lic.services.orchestrator import ejecutar_scrape
import pytest


@pytest.mark.django_db
def test_ejecutar_scrape_marks_job_completado_when_no_errors():
    job = ScrapeJob.objects.create(trigger="manual", no_cia="01")
    credencial = {"no_cia": "01", "usuario_portal": "abregonza", "password_cifrado": "x"}

    with patch("apps.lic.services.orchestrator.lic_repo") as repo, \
         patch("apps.lic.services.orchestrator.crypto") as crypto, \
         patch("apps.lic.services.orchestrator.LicitacionesScraper") as ScraperCls:
        repo.get_credencial_con_password.return_value = credencial
        crypto.decrypt.return_value = "plain-password"
        repo.upsert_oportunidad.return_value = (1, True)
        scraper_instance = MagicMock()
        scraper_instance.list_oportunidades.return_value = [
            {"referencia": "REF-1", "titulo": "algo"}
        ]
        scraper_instance.download_documentos.return_value = [
            {"tipo_documento": "Pliego", "nombre_archivo": "pliego.pdf", "ruta_archivo": "/x/pliego.pdf", "estado": "ok"}
        ]
        ScraperCls.return_value.__enter__.return_value = scraper_instance

        ejecutar_scrape(job, empresas=["01"])

    job.refresh_from_db()
    assert job.estado == "completado"
    assert job.resumen["oportunidades_nuevas"] == 1
    assert job.resumen["documentos_descargados"] == 1
    repo.guardar_documento.assert_called_once_with(
        1, "Pliego", "pliego.pdf", "/x/pliego.pdf", estado="ok"
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
    assert "01" in job.resumen["errores"]


@pytest.mark.django_db
def test_ejecutar_scrape_does_not_download_documents_for_existing_oportunidad():
    """Solo se descargan documentos para oportunidades NUEVAS, no las ya vistas."""
    job = ScrapeJob.objects.create(trigger="manual", no_cia="01")
    credencial = {"no_cia": "01", "usuario_portal": "abregonza", "password_cifrado": "x"}

    with patch("apps.lic.services.orchestrator.lic_repo") as repo, \
         patch("apps.lic.services.orchestrator.crypto") as crypto, \
         patch("apps.lic.services.orchestrator.LicitacionesScraper") as ScraperCls:
        repo.get_credencial_con_password.return_value = credencial
        crypto.decrypt.return_value = "plain-password"
        repo.upsert_oportunidad.return_value = (1, False)  # ya existía
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
    assert "01:REF-1:documentos" in job.resumen["errores"]


@pytest.mark.django_db
def test_ejecutar_scrape_uses_placeholder_for_failed_document_entry():
    """Una entrada de documento individual con estado='error' trae nombre/ruta en None
    (ver scraper.py::download_documentos); NOMBRE_ARCHIVO y RUTA_ARCHIVO son NOT NULL en
    Oracle (y '' se trata como NULL), así que debe sustituirse por un placeholder no vacío
    en vez de propagar None/''."""
    job = ScrapeJob.objects.create(trigger="manual", no_cia="01")
    credencial = {"no_cia": "01", "usuario_portal": "abregonza", "password_cifrado": "x"}

    with patch("apps.lic.services.orchestrator.lic_repo") as repo, \
         patch("apps.lic.services.orchestrator.crypto") as crypto, \
         patch("apps.lic.services.orchestrator.LicitacionesScraper") as ScraperCls:
        repo.get_credencial_con_password.return_value = credencial
        crypto.decrypt.return_value = "plain-password"
        repo.upsert_oportunidad.return_value = (1, True)
        scraper_instance = MagicMock()
        scraper_instance.list_oportunidades.return_value = [
            {"referencia": "REF-1", "titulo": "algo"}
        ]
        scraper_instance.download_documentos.return_value = [
            {
                "tipo_documento": None,
                "nombre_archivo": None,
                "ruta_archivo": None,
                "estado": "error",
                "error": "descarga fallida",
            }
        ]
        ScraperCls.return_value.__enter__.return_value = scraper_instance

        ejecutar_scrape(job, empresas=["01"])

    job.refresh_from_db()
    assert job.resumen["documentos_descargados"] == 0
    args, kwargs = repo.guardar_documento.call_args
    assert args[2]  # nombre_archivo no vacío
    assert args[3]  # ruta_archivo no vacío
    assert kwargs["estado"] == "error"
