from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from .models import (
    FATFactura, FATFacturaL, FATConduce,
    FATCondicionPago, FATListaPrecio, FATTdocu
)
from .serializers import (
    FATFacturaListSerializer, FATFacturaDetailSerializer,
    FATFacturaLSerializer, FATConduceSerializer,
    FATCondicionPagoSerializer, FATListaPrecioSerializer,
    FATTdocuSerializer
)


class FATFacturaViewSet(viewsets.ModelViewSet):
    """ViewSet para facturas"""

    queryset = FATFactura.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['no_cia', 'punto', 'tipo_factura', 'estado', 'st_anulado', 'no_cliente']
    search_fields = ['no_factura', 'no_cliente']
    ordering_fields = ['fecha', 'total_neto']
    ordering = ['-fecha']

    def get_serializer_class(self):
        """Devuelve serializer según acción"""
        if self.action == 'retrieve':
            return FATFacturaDetailSerializer
        elif self.action == 'list':
            return FATFacturaListSerializer
        return FATFacturaDetailSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Crear nueva factura"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Validaciones
        factura_data = serializer.validated_data
        if factura_data.get('no_cliente') is None:
            return Response(
                {'error': 'Cliente requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Crear factura
        factura = FATFactura.objects.create(**factura_data)
        factura.usuario = request.user.username
        factura.save()

        # Procesar líneas si vienen en request
        lineas_data = request.data.get('lineas', [])
        for idx, linea_data in enumerate(lineas_data, 1):
            linea = FATFacturaL(
                factura=factura,
                no_cia=factura.no_cia,
                punto=factura.punto,
                tipo_factura=factura.tipo_factura,
                no_factura=factura.no_factura,
                no_linea=idx,
                **linea_data
            )
            linea.calcular_neto()
            linea.save()

        # Recalcular totales
        factura.calcular_totales()
        factura.save()

        return Response(
            FATFacturaDetailSerializer(factura).data,
            status=status.HTTP_201_CREATED
        )

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        """Actualizar factura (solo si está pendiente)"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        if instance.estado != 'P':
            return Response(
                {'error': 'Solo se pueden editar facturas pendientes'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def generar(self, request, pk=None):
        """Generar (autorizar) factura"""
        factura = self.get_object()

        if factura.estado != 'P':
            return Response(
                {'error': 'Factura no está en estado pendiente'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not factura.lineas.exists():
            return Response(
                {'error': 'Factura sin líneas'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validaciones antes de generar
        try:
            factura.validar()
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Cambiar estado
        factura.estado = 'A'
        factura.usuario = request.user.username
        factura.save()

        # TODO: Generar asiento en CNT si ST_GENERADO_CNT=N
        # TODO: Crear documento en CXC si AFECTA_CXC=S

        return Response(
            FATFacturaDetailSerializer(factura).data,
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def anular(self, request, pk=None):
        """Anular factura"""
        factura = self.get_object()

        if factura.st_anulado == 'S':
            return Response(
                {'error': 'Factura ya está anulada'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Marcar como anulada
        factura.st_anulado = 'S'
        factura.save()

        # TODO: Crear asiento de anulación en CNT
        # TODO: Crear nota de crédito en CXC
        # TODO: Devolver existencia a INV

        return Response(
            {'message': 'Factura anulada correctamente'},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def imprimir(self, request, pk=None):
        """Marcar como impresa"""
        factura = self.get_object()

        if factura.estado != 'A':
            return Response(
                {'error': 'Solo se pueden imprimir facturas autorizadas'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Marcar impresión
        factura.st_impresion = 'S' if factura.st_impresion == 'N' else 'R'
        factura.save()

        # TODO: Generar PDF
        # TODO: Enviar a impresora (si POS)

        return Response(
            {'message': 'Factura marcada como impresa'},
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'])
    def reportes_ventas(self, request):
        """Reporte de ventas por período"""
        desde = request.query_params.get('desde')
        hasta = request.query_params.get('hasta')
        no_cia = request.query_params.get('no_cia')

        queryset = FATFactura.objects.filter(
            estado='A',
            st_anulado='N'
        )

        if desde:
            queryset = queryset.filter(fecha__gte=desde)
        if hasta:
            queryset = queryset.filter(fecha__lte=hasta)
        if no_cia:
            queryset = queryset.filter(no_cia=no_cia)

        data = {
            'total_facturas': queryset.count(),
            'total_neto': sum(f.total_neto for f in queryset),
            'total_impuesto': sum(f.impuesto for f in queryset),
        }

        return Response(data, status=status.HTTP_200_OK)


class FATFacturaLViewSet(viewsets.ModelViewSet):
    """ViewSet para líneas de factura"""

    queryset = FATFacturaL.objects.all()
    serializer_class = FATFacturaLSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filtrar por factura si se proporciona"""
        queryset = super().get_queryset()
        no_factura = self.request.query_params.get('no_factura')
        if no_factura:
            queryset = queryset.filter(no_factura=no_factura)
        return queryset


class FATConduceViewSet(viewsets.ModelViewSet):
    """ViewSet para conduces"""

    queryset = FATConduce.objects.all()
    serializer_class = FATConduceSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'])
    def convertir_factura(self, request, pk=None):
        """Convertir conducé a factura"""
        conduce = self.get_object()

        if conduce.tipo_factura:
            return Response(
                {'error': 'Conducé ya fue convertido a factura'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # TODO: Crear factura desde conducé
        return Response(
            {'message': 'Conducé convertido a factura'},
            status=status.HTTP_200_OK
        )


class FATCondicionPagoViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para condiciones de pago"""

    queryset = FATCondicionPago.objects.all()
    serializer_class = FATCondicionPagoSerializer
    permission_classes = [IsAuthenticated]


class FATListaPrecioViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para listas de precio"""

    queryset = FATListaPrecio.objects.all()
    serializer_class = FATListaPrecioSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['no_produ', 'activa']
    search_fields = ['no_lista', 'no_produ']


class FATTdocuViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para tipos de documento"""

    queryset = FATTdocu.objects.all()
    serializer_class = FATTdocuSerializer
    permission_classes = [IsAuthenticated]
