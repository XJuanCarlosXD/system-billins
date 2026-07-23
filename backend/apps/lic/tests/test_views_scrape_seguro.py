"""Test de la red de seguridad del hilo de fondo de scrape_view.

Sin `_ejecutar_scrape_seguro`, una excepcion no prevista escapando de
`ejecutar_scrape` (que corre en un hilo daemon) dejaria el bloque final que fija
`job.estado/terminado_en/resumen` sin ejecutarse -- el ScrapeJob quedaria atascado
en "corriendo" para siempre, y ademas bloquearia (via la guardia de concurrencia)
cualquier intento futuro para esa empresa hasta que expire el umbral de
antiguedad."""
import pytest

from apps.lic.models import ScrapeJob
from apps.lic.views import _ejecutar_scrape_seguro


@pytest.mark.django_db
def test_marca_error_y_no_relanza_si_ejecutar_scrape_falla(mocker):
    job = ScrapeJob.objects.create(trigger="manual", no_cia="01", estado="corriendo")
    mocker.patch(
        "apps.lic.views.ejecutar_scrape", side_effect=RuntimeError("boom inesperado")
    )

    # No debe propagar la excepcion (el hilo daemon la perderia de todas formas).
    _ejecutar_scrape_seguro(job, ["01"])

    job.refresh_from_db()
    assert job.estado == "error"
    assert job.terminado_en is not None


@pytest.mark.django_db
def test_no_toca_el_job_si_ejecutar_scrape_termina_bien(mocker):
    job = ScrapeJob.objects.create(trigger="manual", no_cia="01", estado="corriendo")

    def _fake_ejecutar(job_arg, empresas):
        job_arg.estado = "completado"
        job_arg.save()

    mocker.patch("apps.lic.views.ejecutar_scrape", side_effect=_fake_ejecutar)

    _ejecutar_scrape_seguro(job, ["01"])

    job.refresh_from_db()
    assert job.estado == "completado"
