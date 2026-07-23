from django.db import models


class ScrapeJob(models.Model):
    TRIGGER_CHOICES = [("auto", "auto"), ("manual", "manual")]
    ESTADO_CHOICES = [
        ("corriendo", "corriendo"),
        ("completado", "completado"),
        ("completado_con_errores", "completado_con_errores"),
        ("error", "error"),
    ]

    trigger = models.CharField(max_length=10, choices=TRIGGER_CHOICES)
    no_cia = models.CharField(max_length=2, null=True, blank=True)
    estado = models.CharField(max_length=30, choices=ESTADO_CHOICES, default="corriendo")
    iniciado_en = models.DateTimeField(auto_now_add=True)
    terminado_en = models.DateTimeField(null=True, blank=True)
    resumen = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-iniciado_en"]
