from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FATFacturaViewSet, FATFacturaLViewSet, FATConduceViewSet,
    FATCondicionPagoViewSet, FATListaPrecioViewSet, FATTdocuViewSet
)

router = DefaultRouter()
router.register(r'facturas', FATFacturaViewSet, basename='fat-factura')
router.register(r'lineas', FATFacturaLViewSet, basename='fat-linea')
router.register(r'conduces', FATConduceViewSet, basename='fat-conduce')
router.register(r'condiciones-pago', FATCondicionPagoViewSet, basename='fat-condicion-pago')
router.register(r'listas-precio', FATListaPrecioViewSet, basename='fat-lista-precio')
router.register(r'tipos-documento', FATTdocuViewSet, basename='fat-tdocu')

urlpatterns = [
    path('', include(router.urls)),
]
