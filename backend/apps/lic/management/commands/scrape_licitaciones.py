"""Comando diario (via cron) que corre el scraping para todas las empresas activas.

Idempotente: si ya hubo una corrida automática completada hoy, no vuelve a correr
(protege contra doble ejecución si el proceso ASGI se reinicia/duplica)."""
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.legacy.repositories import lic_repo
from apps.lic.models import ScrapeJob
from apps.lic.services.orchestrator import ejecutar_scrape


class Command(BaseCommand):
    help = "Corre el scraping diario de licitaciones para todas las empresas con credencial activa"

    def handle(self, *args, **options):
        # timezone.localdate() (no timezone.now().date()): con TIME_ZONE=America/Santo_Domingo
        # (UTC-4) y USE_TZ=True, el lookup __date de abajo convierte iniciado_en a hora local
        # antes de extraer la fecha. timezone.now().date() en cambio toma la fecha en UTC, lo
        # que produce un desfase de un día entero durante la ventana medianoche UTC/8pm-medianoche
        # local -- justo el rango donde puede caer una corrida nocturna de cron.
        hoy = timezone.localdate()
        ya_corrio_hoy = ScrapeJob.objects.filter(
            trigger="auto",
            iniciado_en__date=hoy,
            estado__in=["completado", "completado_con_errores"],
        ).exists()
        if ya_corrio_hoy:
            self.stdout.write("Ya hubo una corrida automática hoy, se omite.")
            return

        empresas = [c["no_cia"] for c in lic_repo.list_credenciales() if c["estado"] == "activo"]
        if not empresas:
            self.stdout.write("No hay empresas con credencial activa.")
            return

        job = ScrapeJob.objects.create(trigger="auto")
        ejecutar_scrape(job, empresas)
        self.stdout.write(f"Corrida {job.id} terminada con estado {job.estado}: {job.resumen}")
