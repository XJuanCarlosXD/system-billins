from django.urls import path
from apps.legacy import odc_views

urlpatterns = [
    # Configuración
    path('cias/', odc_views.odc_cias),
    path('puntos/', odc_views.odc_puntos),
    path('usuarios/', odc_views.odc_usuarios),
    # Órdenes
    path('ordenes/', odc_views.odc_ordenes),
    path('ordenes/<str:no_cia>/<str:punto>/<str:no_orden>/', odc_views.odc_orden),
    path('ordenes/crear/', odc_views.odc_orden_crear),
    path('ordenes/autorizar/', odc_views.odc_orden_autorizar),
    path('ordenes/anular/', odc_views.odc_orden_anular),
    path('ordenes/cerrar/', odc_views.odc_orden_cerrar),
    # Requisiciones
    path('requisiciones/', odc_views.odc_requisiciones),
    path('requisiciones/<str:no_cia>/<str:punto>/<str:no_requisicion>/',
         odc_views.odc_requisicion),
    path('requisiciones/crear/', odc_views.odc_requisicion_crear),
    path('requisiciones/autorizar/', odc_views.odc_requisicion_autorizar),
    path('requisiciones/anular/', odc_views.odc_requisicion_anular),
    path('requisiciones/cerrar/', odc_views.odc_requisicion_cerrar),
    # Reportes
    path('rep-ordenes-pendientes/', odc_views.odc_rep_ordenes_pendientes),
    path('rep-resumen/', odc_views.odc_rep_resumen),
    path('rep-requisiciones-pendientes/', odc_views.odc_rep_requisiciones_pendientes),
]
