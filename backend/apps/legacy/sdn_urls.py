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
]
