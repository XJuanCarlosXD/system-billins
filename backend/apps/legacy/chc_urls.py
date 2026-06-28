from django.urls import path
from apps.legacy import chc_views
from apps.legacy.docs_print_data import (
    chc_cheque_print_data,
    chc_rep_movimientos_print_data,
    chc_rep_diario_print_data,
    chc_rep_disponibilidad_print_data,
)

urlpatterns = [
    path('cheques/<str:tipo_docu>/<str:no_docu>/print-data/', chc_cheque_print_data),
    path('bancos/', chc_views.chc_bancos),
    path('cias/', chc_views.chc_cias),
    path('puntos/', chc_views.chc_puntos),
    path('cuentas/', chc_views.chc_cuentas),
    path('cuentas/saldo/', chc_views.chc_cuenta_saldo),
    path('cheques/', chc_views.chc_cheques),
    path('cheques/<str:no_cia>/<str:punto>/<str:tipo_docu>/<str:no_docu>/', chc_views.chc_cheque),
    path('cheques/solicitar/', chc_views.chc_cheque_solicitar),
    path('cheques/anular/', chc_views.chc_cheque_anular),
    path('cheques/entregar/', chc_views.chc_cheque_entregar),
    path('cheques/conciliar/', chc_views.chc_cheque_conciliar),
    path('cheques/conciliar-bulk/', chc_views.chc_conciliar_bulk),
    path('cierres/conciliacion/', chc_views.chc_cierre_conciliacion),
    path('tipos-docu/', chc_views.chc_tipos_docu),
    path('cierres/', chc_views.chc_cierres),
    path('rep-resumen-cuenta/', chc_views.chc_rep_resumen_cuenta),
    path('rep-balance/', chc_views.chc_rep_balance),
    path('rep-movimientos/', chc_views.chc_rep_movimientos),
    path('rep-diario/', chc_views.chc_rep_diario),
    path('rep-disponibilidad/', chc_views.chc_rep_disponibilidad),
    path('rep-movimientos/print-data/', chc_rep_movimientos_print_data),
    path('rep-diario/print-data/', chc_rep_diario_print_data),
    path('rep-disponibilidad/print-data/', chc_rep_disponibilidad_print_data),
]
