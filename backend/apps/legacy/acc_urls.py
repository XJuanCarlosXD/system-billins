from django.urls import path
from apps.legacy import acc_views
from apps.legacy.docs_print_data import (
    acc_documento_print_data,
    acc_reposicion_print_data,
    acc_listado_docs_print_data,
    acc_resumen_gastos_print_data,
)

urlpatterns = [
    # Config
    path('cias/', acc_views.acc_cias),
    path('puntos/', acc_views.acc_puntos),
    path('cajas/', acc_views.acc_cajas),
    path('cajas/save/', acc_views.acc_caja_save),
    path('cajas/<str:no_cia>/<str:punto>/<str:no_caja>/', acc_views.acc_caja_delete),
    # Beneficiarios / tipos
    path('beneficiarios/', acc_views.acc_beneficiarios),
    path('beneficiarios/save/', acc_views.acc_beneficiario_save),
    path('beneficiarios/<str:no_bene>/', acc_views.acc_beneficiario_delete),
    path('tipos-bene/', acc_views.acc_tipos_bene),
    path('tipos-bene/save/', acc_views.acc_tipo_bene_save),
    path('tipos-bene/<str:tipo_bene>/', acc_views.acc_tipo_bene_delete),
    path('tipos-gasto/', acc_views.acc_tipos_gasto),
    path('tipos-gasto/save/', acc_views.acc_tipo_gasto_save),
    path('tipos-gasto/<str:tipo_gasto>/', acc_views.acc_tipo_gasto_delete),
    # Documentos / egresos — orden importa: paths estáticos antes del wildcard
    path('documentos/', acc_views.acc_documentos),
    path('documentos/crear/', acc_views.acc_documento_crear),
    path('documentos/anular/', acc_views.acc_documento_anular),
    path('documentos/corregir/', acc_views.acc_documento_corregir),
    path('documentos/listado/print-data/', acc_listado_docs_print_data),
    path('documentos/<str:no_docu>/print-data/', acc_documento_print_data),
    path('documentos/<str:no_cia>/<str:punto>/<str:no_docu>/', acc_views.acc_documento),
    # Reposiciones
    path('reposiciones/', acc_views.acc_reposiciones),
    path('reposiciones/<str:no_cia>/<str:punto>/<str:no_reposicion>/',
         acc_views.acc_reposicion_detalle),
    path('reposiciones/crear/', acc_views.acc_reposicion_crear),
    path('reposiciones/anular/', acc_views.acc_reposicion_anular),
    path('reposiciones/generar-solicitud/', acc_views.acc_reposicion_generar_solicitud),
    path('reposiciones/<str:no_reposicion>/print-data/', acc_reposicion_print_data),
    path('docs-pendientes-reposicion/', acc_views.acc_docs_pendientes_reposicion),
    # Asiento contable
    path('asiento/', acc_views.acc_asiento),
    # Cierre mensual
    path('cierre/status/', acc_views.acc_cierre_status),
    path('cierre/', acc_views.acc_cierre_list),
    path('cierre/aplicar/', acc_views.acc_cierre_aplicar),
    # Reportes
    path('rep-resumen/', acc_views.acc_rep_resumen),
    path('rep-gastos-tipo/', acc_views.acc_rep_gastos_tipo),
    path('rep-resumen/print-data/', acc_resumen_gastos_print_data),
]
