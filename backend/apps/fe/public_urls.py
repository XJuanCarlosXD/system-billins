"""Rutas públicas e-CF exigidas por el formulario de postulación de la DGII:
URL de autenticación, de recepción y de aprobación comercial. Montadas en
la raíz (`/fe/...`), ver facturation_api/urls.py.
"""
from django.urls import path

from apps.fe import public_views

urlpatterns = [
    path('autenticacion/api/semilla', public_views.semilla_view),
    path('autenticacion/api/validacioncertificado',
         public_views.validacioncertificado_view),
    path('recepcion/api/ecf', public_views.recepcion_view),
    path('aprobacioncomercial/api/ecf',
         public_views.aprobacioncomercial_view),
]
