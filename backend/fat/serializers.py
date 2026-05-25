from rest_framework import serializers
from .models import (
    FATFactura, FATFacturaL, FATConduce,
    FATCondicionPago, FATListaPrecio, FATTdocu
)


class FATFacturaLSerializer(serializers.ModelSerializer):
    """Serializer para líneas de factura"""

    class Meta:
        model = FATFacturaL
        fields = [
            'no_linea', 'no_produ', 'descripcion', 'almacen',
            'cantidad', 'precio', 'costo', 'precio_de_lista',
            'porc_descuento', 'descuento', 'porciento_impuesto',
            'impuesto', 'monto_neto', 'empaque',
            'cantidad_porciones', 'no_lote', 'cantidad_regalia',
            'st_anulado'
        ]
        read_only_fields = ['descuento', 'impuesto', 'monto_neto']

    def validate(self, data):
        """Validar línea"""
        if data['cantidad'] <= 0:
            raise serializers.ValidationError("Cantidad debe ser mayor a 0")
        if data['precio'] <= 0:
            raise serializers.ValidationError("Precio debe ser mayor a 0")
        return data


class FATFacturaListSerializer(serializers.ModelSerializer):
    """Serializer para listar facturas (simplificado)"""

    class Meta:
        model = FATFactura
        fields = [
            'no_factura', 'tipo_factura', 'no_cliente',
            'fecha', 'vendedor', 'total_neto', 'estado',
            'st_anulado', 'st_impresion', 'st_generado_cnt'
        ]


class FATFacturaDetailSerializer(serializers.ModelSerializer):
    """Serializer para detalle de factura (con líneas)"""

    lineas = FATFacturaLSerializer(many=True, read_only=True)

    class Meta:
        model = FATFactura
        fields = [
            'no_cia', 'punto', 'tipo_factura', 'no_factura',
            'no_cliente', 'fecha', 'vendedor', 'afecta_cxc',
            'tasa_us', 'porc_impuesto', 'descuento', 'impuesto',
            'total_linea', 'total_neto', 'estado', 'usuario',
            'st_generado_cnt', 'st_impresion', 'st_anulado',
            'tipo_transaccion', 'plazo_pago', 'forma_pago',
            'ncf', 'codigo_ncf', 'tipo_ncf_fiscal',
            'cajero', 'valor_recibido', 'valor_devuelto',
            'propina', 'ruta', 'detalle', 'nota',
            'fecha_impresion', 'fecha_venta',
            'lineas',
        ]

    def create(self, validated_data):
        """Crear factura"""
        factura = FATFactura.objects.create(**validated_data)
        return factura

    def update(self, instance, validated_data):
        """Actualizar factura (solo si está pendiente)"""
        if instance.estado != 'P':
            raise serializers.ValidationError("Solo se pueden editar facturas pendientes")
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class FATConduceSerializer(serializers.ModelSerializer):
    """Serializer para conduces"""

    class Meta:
        model = FATConduce
        fields = [
            'no_cia', 'punto', 'tipo_conduce', 'no_conduce',
            'no_cliente', 'fecha', 'vendedor',
            'tipo_moneda', 'tasa_us', 'descuento', 'impuesto',
            'total_linea', 'total_neto', 'st_anulado', 'autorizado',
            'tipo_factura', 'no_factura', 'detalle', 'usuario'
        ]


class FATCondicionPagoSerializer(serializers.ModelSerializer):
    """Serializer para condiciones de pago"""

    class Meta:
        model = FATCondicionPago
        fields = ['no_condicion', 'descripcion', 'dias']


class FATListaPrecioSerializer(serializers.ModelSerializer):
    """Serializer para listas de precio"""

    class Meta:
        model = FATListaPrecio
        fields = [
            'no_lista', 'descripcion', 'no_produ',
            'precio', 'fecha_vigencia', 'activa'
        ]


class FATTdocuSerializer(serializers.ModelSerializer):
    """Serializer para tipos de documento"""

    class Meta:
        model = FATTdocu
        fields = [
            'tipo_doc', 'descripcion', 'codigo_ncf',
            'tipo_transaccion', 'afecta_cxc', 'activo',
            'ncf_inicial', 'ncf_final', 'prox_ncf'
        ]
