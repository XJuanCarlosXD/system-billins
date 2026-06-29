"""Management command: marca filas TCHAT_TOOL_PENDING expiradas como 'X'.

Pensado para correrse via cron cada minuto:
    * * * * * docker compose exec -T backend python manage.py \
        asistente_expire_pending
"""

from django.core.management.base import BaseCommand

from apps.asistente import audit


class Command(BaseCommand):
    help = "Expira filas TCHAT_TOOL_PENDING vencidas (STATUS='P' -> 'X')."

    def handle(self, *args, **options):
        n = audit.expire_pending()
        self.stdout.write(self.style.SUCCESS(f"expired={n}"))
