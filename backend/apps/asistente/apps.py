from django.apps import AppConfig


class AsistenteConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.asistente"
    label = "asistente"
    verbose_name = "Asistente en pagina (ZentoryERP)"

    def ready(self):
        # Import side-effect: cada modulo registra sus tools en REGISTRY.
        from apps.asistente.tools import registry  # noqa: F401
        from apps.asistente.tools import memoria   # noqa: F401
        from apps.asistente.tools import doc_types  # noqa: F401
        from apps.asistente.tools import skills    # noqa: F401
        from apps.asistente.tools import fat       # noqa: F401
