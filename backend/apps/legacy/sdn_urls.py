from django.urls import path
from apps.legacy import sdn_views
from apps.legacy.docs_print_data import sdn_nomina_print_data

urlpatterns = [
    path('nominas/<str:nomina>/print-data/', sdn_nomina_print_data),
    path('cias/', sdn_views.sdn_cias),
    path('afp/', sdn_views.sdn_afp),
    path('ars/', sdn_views.sdn_ars),
    path('gerencias/', sdn_views.sdn_gerencias),
    path('areas/', sdn_views.sdn_areas),
    path('deptos/', sdn_views.sdn_deptos),
    path('ingresos/', sdn_views.sdn_ingresos),
    path('deducciones/', sdn_views.sdn_deducciones),
    path('empleados/', sdn_views.sdn_empleados),
    path('empleados/<str:no_cia>/<int:no_empleado>/', sdn_views.sdn_empleado),
    path('nominas/', sdn_views.sdn_nominas),
    path('nominas/crear/', sdn_views.sdn_nomina_crear),
    path('nominas/actualizar/', sdn_views.sdn_nomina_actualizar),
    path('nominas/anular/', sdn_views.sdn_nomina_anular),
    path('nominas/calcular/', sdn_views.sdn_nomina_calcular),
    path('nominas/reabrir/', sdn_views.sdn_nomina_reabrir),
    path('nominas/volante/', sdn_views.sdn_nomina_volante),
    path('vacaciones/', sdn_views.sdn_vacaciones),
    path('rep-empleados/', sdn_views.sdn_rep_resumen_empleados),
    path('rep-nominas/', sdn_views.sdn_rep_nominas_resumen),
    # Movimientos manuales (Fsdn204/205)
    path('movimientos/', sdn_views.sdn_movimientos_list),
    path('movimientos/crear/', sdn_views.sdn_movimientos_crear),
    path('movimientos/eliminar/', sdn_views.sdn_movimientos_eliminar),
    # Generar Vacaciones (Fsdn401)
    path('vacaciones/generar/', sdn_views.sdn_generar_vacaciones),
    # Solicitud de Cheques de Nómina (Fsdn409) — preview
    path('cheques/preview/', sdn_views.sdn_preview_cheques),
    # Informe de Nómina (Fsdn207)
    path('rep-informe/', sdn_views.sdn_rep_informe),
    # RNC Empleados (DGII)
    path('rep-rnc/', sdn_views.sdn_rep_empleados_rnc),
]
