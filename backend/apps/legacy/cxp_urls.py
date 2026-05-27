from django.urls import path
from apps.legacy import cxp_views

urlpatterns = [
    path('proveedores/', cxp_views.cxp_proveedores),
    path('proveedores/<str:no>/', cxp_views.cxp_proveedor),
    path('proveedores/<str:no>/cuenta/', cxp_views.cxp_proveedor_cuenta),
    path('proveedores/<str:no>/cuentas/', cxp_views.cxp_cuentas_proveedor),
    path('proveedores/<str:no>/movimientos/', cxp_views.cxp_movimientos_proveedor),
    path('documentos/', cxp_views.cxp_documentos),
    path('documentos/<str:no_cia>/<str:punto>/<str:tipo>/<str:no>/', cxp_views.cxp_documento),
    path('aging/', cxp_views.cxp_aging),
    path('tipos-docu/', cxp_views.cxp_tipos_docu),
    # Configuración
    path('cias/', cxp_views.cxp_cias),
    path('puntos/', cxp_views.cxp_puntos),
    path('tproveedores/', cxp_views.cxp_tproveedores),
    path('tdocu-config/', cxp_views.cxp_tdocu_config),
    path('ciudades/', cxp_views.cxp_ciudades),
    path('barrios/', cxp_views.cxp_barrios),
    # Reportes read-only
    path('rep-alfabetico/', cxp_views.cxp_rep_alfabetico),
    path('rep-mayor/', cxp_views.cxp_rep_mayor),
    path('rep-606/', cxp_views.cxp_rep_606),
    path('rep-607/', cxp_views.cxp_rep_607),
    # Procesos escritura
    path('entrada-documentos/', cxp_views.cxp_entrada_documentos),
    path('reversar/', cxp_views.cxp_reversar),
    path('liberar-debito/', cxp_views.cxp_liberar_debito),
    path('bloquear-pago/', cxp_views.cxp_bloquear_pago),
    # Cierre / asiento
    path('asiento-contable/', cxp_views.cxp_asiento_contable),
    path('generar-asiento/', cxp_views.cxp_generar_asiento),
    path('cierre/', cxp_views.cxp_cierre),
]
