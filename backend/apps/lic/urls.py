from django.urls import path

from apps.lic import views

urlpatterns = [
    path("credenciales/", views.credenciales_view),
    path("credenciales/probar-conexion/", views.probar_conexion_view),
    path("rubros-pdf/", views.rubros_pdf_view),
    path("oportunidades/", views.oportunidades_view),
    path("oportunidades/<int:oportunidad_id>/documentos/", views.documentos_view),
    path("documentos/<int:documento_id>/resumen/", views.resumen_documento_view),
    path("documentos-empresa/", views.documentos_empresa_view),
    path("documentos-empresa/<int:documento_empresa_id>/descargar/", views.documento_empresa_descargar_view),
    path("tipos-documento/", views.tipos_documento_view),
    path("tipos-documento/<int:tipo_id>/", views.tipo_documento_detail_view),
    path("oportunidades/<int:oportunidad_id>/analizar/", views.analizar_oportunidad_view),
    path("oportunidades/<int:oportunidad_id>/requisitos/", views.requisitos_view),
    path("oportunidades/<int:oportunidad_id>/productos/", views.productos_view),
    path("oportunidades/<int:oportunidad_id>/recomendar-precios/", views.recomendar_precios_oportunidad_view),
    path("documentos/<int:documento_id>/descargar/", views.documento_descargar_view),
    path("oportunidades/<int:oportunidad_id>/preparar-oferta/", views.preparar_oferta_view),
    path("oferta-jobs/<int:job_id>/", views.oferta_job_view),
    path("scrape/", views.scrape_view),
    path("scrape/<int:job_id>/", views.scrape_job_view),
]
