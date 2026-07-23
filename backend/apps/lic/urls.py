from django.urls import path

from apps.lic import views

urlpatterns = [
    path("credenciales/", views.credenciales_view),
    path("credenciales/probar-conexion/", views.probar_conexion_view),
    path("rubros-pdf/", views.rubros_pdf_view),
    path("oportunidades/", views.oportunidades_view),
    path("oportunidades/<int:oportunidad_id>/documentos/", views.documentos_view),
    path("scrape/", views.scrape_view),
    path("scrape/<int:job_id>/", views.scrape_job_view),
]
