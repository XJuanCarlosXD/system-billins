from django.urls import path

from apps.fe import views

urlpatterns = [
    path('config/', views.config_view),
    path('config/certificado/', views.certificado_view),
    path('config/probar-conexion/', views.probar_conexion_view),
    path('secuencias/', views.secuencias_view),
]
