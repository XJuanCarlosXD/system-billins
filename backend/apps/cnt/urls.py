from django.urls import path
from . import views

urlpatterns = [
    path('cnt/config/', views.CntConfigView.as_view()),
    path('cnt/catalogo/', views.CatalogoListView.as_view()),
    path('cnt/catalogo/<str:cuenta>/', views.CatalogoDetailView.as_view()),
    path('cnt/tcuenta/', views.TcuentaListView.as_view()),
    path('cnt/centros-costo/', views.CentrosCostoView.as_view()),
    path('cnt/periodos/', views.PeriodosView.as_view()),
    path('cnt/ncf/', views.NcfListView.as_view()),
    path('cnt/ncf/<str:codigo_ncf>/', views.NcfDetailView.as_view()),
    path('cnt/asientos/', views.AsientosListView.as_view()),
    path('cnt/asientos/<int:no_asiento>/', views.AsientoDetailView.as_view()),
    path('cnt/asientos/<int:no_asiento>/aprobar/', views.AprobarAsientoView.as_view()),
    path('cnt/asientos/<int:no_asiento>/actualizar/', views.ActualizarAsientoView.as_view()),
    path('cnt/asientos/<int:no_asiento>/anular/', views.AnularAsientoView.as_view()),
    path('cnt/balance/', views.BalanceView.as_view()),
    path('cnt/mayor/', views.MayorView.as_view()),
    path('cnt/cierres/', views.CierresView.as_view()),
]
