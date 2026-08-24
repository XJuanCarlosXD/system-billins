from django.urls import path
from . import views
from apps.legacy.docs_print_data import (
    cnt_asiento_print_data, cnt_grupos_contables_print_data, cnt_catalogo_cuentas_print_data,
)

urlpatterns = [
    path('cnt/asientos/<int:ano>/<int:mes>/<int:no_asiento>/print-data/', cnt_asiento_print_data),
    path('cnt/grupos-contables/print-data/', cnt_grupos_contables_print_data),
    path('cnt/catalogo/print-data/', cnt_catalogo_cuentas_print_data),
    # Config base
    path('cnt/config/', views.CntConfigView.as_view()),

    # Compañías (FCNT101)
    path('cnt/cias/', views.CiasView.as_view()),

    # Sucursales/Puntos (FCNT102)
    path('cnt/sucursales/', views.SucursalesView.as_view()),

    # Grupos Contables (FCNT107)
    path('cnt/grupos-contables/', views.GruposContablesView.as_view()),

    # Catálogo de cuentas (FCNT105)
    path('cnt/catalogo/', views.CatalogoListView.as_view()),
    path('cnt/catalogo/<str:cuenta>/', views.CatalogoDetailView.as_view()),

    # Tipos de cuenta (FCNT104)
    path('cnt/tcuenta/', views.TcuentaListView.as_view()),
    path('cnt/tcuenta/<str:tipo>/', views.TcuentaDetailView.as_view()),
    path('cnt/cia-header/', views.CiaHeaderView.as_view()),
    path('cnt/cia-logo/<str:no_cia>/', views.CiaLogoView.as_view()),

    # Centros de costo (FCNT108)
    path('cnt/centros-costo/', views.CentrosCostoView.as_view()),

    # Períodos y cierres histórico
    path('cnt/periodos/', views.PeriodosView.as_view()),
    path('cnt/cierres/', views.CierresView.as_view()),

    # NCF (FCNT114)
    path('cnt/ncf/', views.NcfListView.as_view()),
    path('cnt/ncf/<str:codigo_ncf>/', views.NcfDetailView.as_view()),

    # Asientos (FCNT201 / FCNT501)
    path('cnt/asientos/', views.AsientosListView.as_view()),
    path('cnt/asientos/<int:no_asiento>/', views.AsientoDetailView.as_view()),
    path('cnt/asientos/<int:no_asiento>/aprobar/', views.AprobarAsientoView.as_view()),
    path('cnt/asientos/<int:no_asiento>/actualizar/', views.ActualizarAsientoView.as_view()),
    path('cnt/asientos/<int:no_asiento>/anular/', views.AnularAsientoView.as_view()),

    # Autorizar mes completo (FCNT202)
    path('cnt/autorizar-mes/', views.AutorizarMesView.as_view()),

    # Reportes
    path('cnt/balance/', views.BalanceView.as_view()),
    path('cnt/mayor/', views.MayorView.as_view()),

    # Cierre mensual (FCNT401) y cierre fiscal (FCNT402)
    path('cnt/cierre-mensual/', views.CierreMensualView.as_view()),

    # Autorizar meses anteriores (FCNT204)
    path('cnt/autorizar-mes-anterior/', views.AutorizarMesAnteriorView.as_view()),

    # Asignar cuentas a sucursal (FCNT106)
    path('cnt/catalogo-sucursal/', views.CatalogoSucursalView.as_view()),

    # Reportes financieros
    path('cnt/presupuesto/', views.PresupuestoView.as_view()),
    path('cnt/estado-resultados/', views.EstadoResultadosView.as_view()),
]