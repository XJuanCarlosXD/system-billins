from django.urls import path
from .views_complete import (
    # Facturas CRUD
    FacturasListView,
    FacturaDetailView,
    FacturaGenerarView,
    FacturaAnularView,
    FacturaImprimirView,
    # Líneas
    LineasView,
    LineaDetailView,
    # Conduces
    ConducesView,
    ConduceConvertirView,
    # Lookups
    CondicionesPagoView,
    ListasPrecioView,
    DocumentosView,
    # Reportes
    ReportesVentasView,
    # Existentes
    FatNCFListView,
    FatNCFAlertsView,
    FatSearchView,
)

urlpatterns = [
    # FACTURAS — CRUD
    path('fat/facturas/', FacturasListView.as_view(), name='fat-facturas-list'),
    path('fat/facturas/<str:no_factura>/', FacturaDetailView.as_view(), name='fat-factura-detail'),
    path('fat/facturas/<str:no_factura>/generar/', FacturaGenerarView.as_view(), name='fat-factura-generar'),
    path('fat/facturas/<str:no_factura>/anular/', FacturaAnularView.as_view(), name='fat-factura-anular'),
    path('fat/facturas/<str:no_factura>/imprimir/', FacturaImprimirView.as_view(), name='fat-factura-imprimir'),

    # LÍNEAS
    path('fat/lineas/', LineasView.as_view(), name='fat-lineas-list'),
    path('fat/lineas/<int:linea_id>/', LineaDetailView.as_view(), name='fat-linea-detail'),

    # CONDUCES
    path('fat/conduces/', ConducesView.as_view(), name='fat-conduces-list'),
    path('fat/conduces/<str:no_conduce>/convertir-factura/', ConduceConvertirView.as_view(), name='fat-conduce-convertir'),

    # LOOKUPS
    path('fat/condiciones-pago/', CondicionesPagoView.as_view(), name='fat-condiciones-pago'),
    path('fat/listas-precio/', ListasPrecioView.as_view(), name='fat-listas-precio'),
    path('fat/documentos/', DocumentosView.as_view(), name='fat-documentos'),

    # REPORTES
    path('fat/reportes-ventas/', ReportesVentasView.as_view(), name='fat-reportes-ventas'),

    # EXISTENTES
    path('fat/ncf/', FatNCFListView.as_view(), name='fat-ncf-list'),
    path('fat/ncf/alerts/', FatNCFAlertsView.as_view(), name='fat-ncf-alerts'),
    path('fat/search/', FatSearchView.as_view(), name='fat-search'),
]
