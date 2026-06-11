"""CXC URL patterns — include in main urls.py under /api/cxc/."""
from django.urls import path
from .docs_print_data import cxc_documento_print_data
from .cxc_views import (
    CxcCiasView, CxcPuntosView, CxcPuntoDetailView,
    CxcTdocuView, CxcTcliView, CxcSupervisoresView,
    CxcVendedoresView, CxcRutasView, CxcTcontableView,
    CxcCiudadesView, CxcBarriosView, CxcZonasView, CxcCadenasView,
    CxcClientesView, CxcClienteDetailView, CxcClientesRutaView,
    CxcDocumentosView, CxcDocumentoDetailView, CxcNextDocView,
    CxcReversarView, CxcPagosMasivosView, CxcLiberarCreditoView,
    CxcCorregirNcfView,
    CxcEstadoCuentaView, CxcBalanceClientesView, CxcHistoricoView, CxcLibroVentasView,
    CxcRepEnvejecimientoView, CxcRepCobrosVendedorView, CxcRepComisionesView, CxcRepNcfView,
    CxcAsientoContableView, CxcGenerarAsientoView, CxcCierreView,
)

urlpatterns = [
    # print-data
    path('documentos/<str:no_docu>/print-data/', cxc_documento_print_data),
    # Configuración
    path('cias/', CxcCiasView.as_view()),
    path('puntos/', CxcPuntosView.as_view()),
    path('puntos/<str:no_cia>/<str:punto>/', CxcPuntoDetailView.as_view()),
    path('tdocu/', CxcTdocuView.as_view()),
    path('tcli/', CxcTcliView.as_view()),
    path('supervisores/', CxcSupervisoresView.as_view()),
    path('vendedores/', CxcVendedoresView.as_view()),
    path('rutas/', CxcRutasView.as_view()),
    path('tcontable/', CxcTcontableView.as_view()),
    path('ciudades/', CxcCiudadesView.as_view()),
    path('barrios/', CxcBarriosView.as_view()),
    path('zonas/', CxcZonasView.as_view()),
    path('cadenas/', CxcCadenasView.as_view()),
    # Clientes
    path('clientes/', CxcClientesView.as_view()),
    path('clientes/<str:no_cia>/<str:no_cliente>/', CxcClienteDetailView.as_view()),
    path('clientes-ruta/', CxcClientesRutaView.as_view()),
    # Documentos
    path('documentos/', CxcDocumentosView.as_view()),
    path('documentos/<str:no_cia>/<str:no_doc>/', CxcDocumentoDetailView.as_view()),
    path('next-doc/', CxcNextDocView.as_view()),
    # Procesos
    path('reversar/', CxcReversarView.as_view()),
    path('pagos-masivos/', CxcPagosMasivosView.as_view()),
    path('liberar-credito/', CxcLiberarCreditoView.as_view()),
    path('corregir-ncf/', CxcCorregirNcfView.as_view()),
    # Consultas
    path('estado-cuenta/', CxcEstadoCuentaView.as_view()),
    path('balance-clientes/', CxcBalanceClientesView.as_view()),
    path('historico/', CxcHistoricoView.as_view()),
    path('libro-ventas/', CxcLibroVentasView.as_view()),
    # Reportes
    path('rep-envejecimiento/', CxcRepEnvejecimientoView.as_view()),
    path('rep-cobros-vendedor/', CxcRepCobrosVendedorView.as_view()),
    path('rep-comisiones/', CxcRepComisionesView.as_view()),
    path('rep-ncf/', CxcRepNcfView.as_view()),
    # Cierre
    path('asiento-contable/', CxcAsientoContableView.as_view()),
    path('generar-asiento/', CxcGenerarAsientoView.as_view()),
    path('cierre/', CxcCierreView.as_view()),
]
