from django.urls import path

from apps.fe import views

urlpatterns = [
    path('config/', views.config_view),
    path('config/certificado/', views.certificado_view),
    path('config/probar-conexion/', views.probar_conexion_view),
    path('secuencias/', views.secuencias_view),
    path('documentos/', views.documentos_view),
    path('documentos/<str:e_ncf>/', views.documento_detalle_view),
    path('documentos/<str:e_ncf>/consultar-estado/',
         views.documento_consultar_estado_view),
    path('documentos/<str:e_ncf>/reenviar/', views.documento_reenviar_view),
    path('pruebas/enviar/', views.pruebas_enviar_view),
]
