from django.urls import path
from apps.legacy import cxp_views
from apps.legacy.docs_print_data import (
    cxp_documento_print_data, cxp_estado_cuenta_print_data,
    cxp_rep_alfabetico_print_data, cxp_rep_mayor_print_data,
    cxp_rep_606_print_data, cxp_rep_607_print_data,
    cxp_rep_cuadre_print_data, cxp_rep_retenciones_print_data,
    cxp_rep_envejecimiento_print_data,
)

urlpatterns = [
    path('documentos/<str:tipo_docu>/<str:no_docu>/print-data/', cxp_documento_print_data),
    path('proveedores/<str:no_proveedor>/estado-cuenta/print-data/', cxp_estado_cuenta_print_data),
    path('proveedores/', cxp_views.cxp_proveedores),
    path('proveedores/<str:no>/', cxp_views.cxp_proveedor),
    path('proveedores/<str:no>/cuenta/', cxp_views.cxp_proveedor_cuenta),
    path('cuenta-itbis-default/', cxp_views.cxp_cuenta_itbis_default),
    path('proveedores/<str:no>/ncf-info/', cxp_views.cxp_proveedor_ncf_info),
    path('proveedores/<str:no>/cuentas/', cxp_views.cxp_cuentas_proveedor),
    path('proveedores/<str:no>/movimientos/', cxp_views.cxp_movimientos_proveedor),
    path('documentos/', cxp_views.cxp_documentos),
    path('documentos/<str:no_cia>/<str:punto>/<str:tipo>/<str:no>/', cxp_views.cxp_documento),
    path('aging/', cxp_views.cxp_aging),
    path('estado-cuenta/', cxp_views.cxp_estado_cuenta),
    path('tipos-docu/', cxp_views.cxp_tipos_docu),
    path('tipos-gasto/', cxp_views.cxp_tipos_gasto),
    path('tipos-retencion/', cxp_views.cxp_tipos_retencion),
    path('formas-pago/', cxp_views.cxp_formas_pago),
    # Configuración
    path('cias/', cxp_views.cxp_cias),
    path('puntos/', cxp_views.cxp_puntos),
    path('tproveedores/', cxp_views.cxp_tproveedores),
    path('tdocu-config/', cxp_views.cxp_tdocu_config),
    path('ciudades/', cxp_views.cxp_ciudades),
    path('barrios/', cxp_views.cxp_barrios),
    path('usuarios/', cxp_views.cxp_usuarios),
    # Reportes read-only
    path('rep-alfabetico/print-data/', cxp_rep_alfabetico_print_data),
    path('rep-mayor/print-data/', cxp_rep_mayor_print_data),
    path('rep-606/print-data/', cxp_rep_606_print_data),
    path('rep-607/print-data/', cxp_rep_607_print_data),
    path('rep-cuadre/print-data/', cxp_rep_cuadre_print_data),
    path('rep-retenciones/print-data/', cxp_rep_retenciones_print_data),
    path('rep-envejecimiento/print-data/', cxp_rep_envejecimiento_print_data),
    path('rep-alfabetico/', cxp_views.cxp_rep_alfabetico),
    path('rep-mayor/', cxp_views.cxp_rep_mayor),
    path('rep-606/', cxp_views.cxp_rep_606),
    path('rep-606/archivo-dgii/', cxp_views.cxp_rep_606_archivo_dgii),
    path('rep-607/', cxp_views.cxp_rep_607),
    path('rep-cuadre/', cxp_views.cxp_rep_cuadre),
    path('rep-retenciones/', cxp_views.cxp_rep_retenciones),
    # Procesos escritura
    path('entrada-documentos/', cxp_views.cxp_entrada_documentos),
    path('reversar/', cxp_views.cxp_reversar),
    path('liberar-debito/', cxp_views.cxp_liberar_debito),
    path('saldos-menores/', cxp_views.cxp_saldos_menores),
    path('bloquear-pago/', cxp_views.cxp_bloquear_pago),
    # Fcxp212 — Corregir NCF / datos DGII
    path('corregir-ncf/', cxp_views.cxp_corregir_ncf),
    # Fcxp206 — Aplicación de Movimientos (saldo a favor)
    path('aplicar-movimientos/', cxp_views.cxp_aplicar_movimientos),
    # Solicitudes de pago (Fcxp209 / Fcxp207 — puente CxP → CHC)
    path('solicitud-cheque/', cxp_views.cxp_solicitud_cheque),
    path('solicitudes-pago/', cxp_views.cxp_solicitudes_pago),
    path('solicitudes-pago/<str:no_docu>/referencias/', cxp_views.cxp_solicitud_referencias),
    # Cierre / asiento
    path('asiento-contable/', cxp_views.cxp_asiento_contable),
    path('generar-asiento/', cxp_views.cxp_generar_asiento),
    path('cierre/', cxp_views.cxp_cierre),
]
