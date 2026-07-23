"""Tests del comando `scrape_licitaciones` (corrida diaria via cron).

El foco principal es una regresión: el comando debe decidir "ya corrió hoy" usando la
fecha LOCAL (settings.TIME_ZONE = America/Santo_Domingo, UTC-4), no la fecha UTC. Con
`timezone.now().date()` (la versión original, con bug) el guard de idempotencia se
desincroniza durante la ventana medianoche-UTC / 8pm-medianoche-local: un ScrapeJob
creado a esa hora tiene una fecha UTC que ya es "mañana" aunque localmente todavía sea
"hoy". La versión corregida usa `timezone.localdate()`, que -- igual que el lookup
`__date` de Django sobre un campo timezone-aware -- convierte a hora local antes de
extraer la fecha."""
import datetime
from io import StringIO
from unittest.mock import patch

import pytest
from django.core.management import call_command

from apps.lic.models import ScrapeJob

# Instante fijo: 2024-01-02 02:30 UTC. En America/Santo_Domingo (UTC-4) esto cae en
# 2024-01-01 22:30 -04:00 -- un día calendario ANTES en hora local. Este es exactamente
# el escenario que timezone.now().date() calculaba mal (habría dado 2024-01-02, la
# fecha UTC, en vez de 2024-01-01, la fecha local real).
UTC_INSTANT_NEAR_LOCAL_MIDNIGHT = datetime.datetime(
    2024, 1, 2, 2, 30, 0, tzinfo=datetime.timezone.utc
)


def _run_command():
    out = StringIO()
    call_command("scrape_licitaciones", stdout=out)
    return out.getvalue()


@pytest.mark.django_db
def test_guard_uses_local_date_not_utc_date_for_a_job_near_local_midnight():
    """Regresión del bug timezone.now().date() vs timezone.localdate().

    Fechas UTC y local difieren para este instante (ver constante de arriba). El guard
    de idempotencia debe basarse en la fecha LOCAL: si "hoy" (local) coincide con el día
    local del ScrapeJob previo, debe omitir la corrida -- aunque la fecha UTC sea otro
    día distinto (que es justamente lo que el código con bug hacía mal)."""
    with patch("django.utils.timezone.now", return_value=UTC_INSTANT_NEAR_LOCAL_MIDNIGHT):
        job = ScrapeJob.objects.create(trigger="auto", estado="completado")
        job.refresh_from_db()

        # Confirma la premisa del test: UTC y local realmente difieren en día calendario
        # para este instante (si no, el test no probaría nada).
        from django.utils import timezone as django_timezone

        assert job.iniciado_en.date() != django_timezone.localdate()
        assert job.iniciado_en.date() == datetime.date(2024, 1, 2)  # fecha UTC
        assert django_timezone.localdate() == datetime.date(2024, 1, 1)  # fecha local

        salida = _run_command()

    assert "Ya hubo una corrida automática hoy, se omite." in salida
    # No se creó un segundo ScrapeJob: el guard efectivamente evitó la corrida duplicada.
    assert ScrapeJob.objects.count() == 1


@pytest.mark.django_db
def test_guard_does_not_fire_for_a_job_from_a_different_local_day():
    """Contraparte del test anterior: si el ScrapeJob previo es de un día LOCAL distinto,
    el guard no debe omitir la corrida (aquí no hay credenciales activas, así que la
    corrida simplemente termina con el mensaje de "no hay empresas")."""
    ayer_utc = UTC_INSTANT_NEAR_LOCAL_MIDNIGHT - datetime.timedelta(days=1)
    with patch("django.utils.timezone.now", return_value=ayer_utc):
        ScrapeJob.objects.create(trigger="auto", estado="completado")

    with patch("django.utils.timezone.now", return_value=UTC_INSTANT_NEAR_LOCAL_MIDNIGHT), \
         patch(
             "apps.lic.management.commands.scrape_licitaciones.lic_repo.list_credenciales",
             return_value=[],
         ):
        salida = _run_command()

    assert "No hay empresas con credencial activa." in salida
    assert "se omite" not in salida


@pytest.mark.django_db
def test_command_marks_job_error_and_reraises_when_ejecutar_scrape_raises_unexpectedly():
    """Si ejecutar_scrape deja escapar una excepción no prevista (no debería, ver
    orchestrator.py, pero el comando no debe confiar ciegamente en eso), el ScrapeJob no
    debe quedar atascado en estado="corriendo" -- se marca "error" y la excepción se
    relanza para que aparezca en el log del cron."""
    with patch(
        "apps.lic.management.commands.scrape_licitaciones.lic_repo.list_credenciales",
        return_value=[{"no_cia": "01", "estado": "activo"}],
    ), patch(
        "apps.lic.management.commands.scrape_licitaciones.ejecutar_scrape",
        side_effect=RuntimeError("boom"),
    ):
        with pytest.raises(RuntimeError, match="boom"):
            call_command("scrape_licitaciones", stdout=StringIO())

    job = ScrapeJob.objects.get(trigger="auto")
    assert job.estado == "error"
    assert job.terminado_en is not None
