from django.apps import AppConfig


class AsistenteConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.asistente"
    label = "asistente"
    verbose_name = "Asistente en pagina (ZentoryERP)"

    def ready(self):
        # Import side-effect: registra tools en REGISTRY.
        from apps.asistente.tools import registry  # noqa: F401
