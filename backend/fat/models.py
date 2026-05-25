from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from datetime import timedelta

class FATFactura(models.Model):
    """Encabezado de facturas"""
    ESTADO_CHOICES = [
        ('P', 'Pendiente'),
        ('A', 'Autorizado'),
        ('C', 'Cerrado'),
    ]

    TIPO_FACTURA_CHOICES = [
        ('FT', 'Factura Contado'),
        ('FC', 'Factura Crédito'),
        ('CT', 'Cotización'),
        ('CO', 'Conducé'),
        ('AF', 'Anulación'),
    ]

    TIPO_TRANSACCION_CHOICES = [
        ('F', 'Factura'),
        ('C', 'Conducé'),
        ('O', 'Orden'),
        ('A', 'Anulación'),
    ]

    TIPO_MONEDA_CHOICES = [
        ('RD', 'Pesos Dominicanos'),
        ('US', 'Dólares USA'),
    ]

    FORMA_PAGO_CHOICES = [
        ('Crédito', 'Crédito'),
        ('Contado', 'Contado'),
        ('Mixto', 'Mixto'),
    ]

    # PK compuesta: no_cia, punto, tipo_factura, no_factura
    no_cia = models.CharField(max_length=2)
    punto = models.CharField(max_length=2, default='01')
    tipo_factura = models.CharField(max_length=2, choices=TIPO_FACTURA_CHOICES)
    no_factura = models.CharField(max_length=7)

    # Cliente y vendedor
    no_cliente = models.IntegerField()  # FK a TCXC_CLIENTE
    vendedor = models.CharField(max_length=4, null=True, blank=True)

    # Fechas
    fecha = models.DateField(default=timezone.now)
    fecha_venta = models.DateField(null=True, blank=True)
    fecha_impresion = models.DateField(null=True, blank=True)
    fecha_despacho = models.DateField(null=True, blank=True)

    # Moneda
    tipo_moneda = models.CharField(max_length=2, choices=TIPO_MONEDA_CHOICES, default='RD')
    tasa_us = models.DecimalField(max_digits=5, decimal_places=2, default=57.50)

    # Impuestos y descuentos
    porc_impuesto = models.DecimalField(max_digits=5, decimal_places=2, default=18.00)
    descuento = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    impuesto = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_linea = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_neto = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Montos especiales
    itbis_retenido = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    isr_retenido = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    propina = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Caja (si POS)
    cajero = models.CharField(max_length=4, null=True, blank=True)
    valor_recibido = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    valor_devuelto = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # Estados
    estado = models.CharField(max_length=1, choices=ESTADO_CHOICES, default='P')
    st_anulado = models.CharField(max_length=1, default='N', choices=[('S', 'Sí'), ('N', 'No')])
    st_generado_cnt = models.CharField(max_length=1, default='N', choices=[('S', 'Sí'), ('N', 'No')])
    st_impresion = models.CharField(max_length=1, default='N', choices=[('S', 'Sí'), ('N', 'No'), ('R', 'Reimpresión')])

    # Datos operacionales
    afecta_cxc = models.CharField(max_length=1, default='S', choices=[('S', 'Sí'), ('N', 'No')])
    tipo_transaccion = models.CharField(max_length=1, choices=TIPO_TRANSACCION_CHOICES, default='F')
    forma_pago = models.CharField(max_length=10, choices=FORMA_PAGO_CHOICES, default='Contado')

    # NCF (Número Comprobante Fiscal)
    ncf = models.IntegerField(null=True, blank=True)
    codigo_ncf = models.CharField(max_length=6, null=True, blank=True)  # FC-001, FT-001, etc.
    tipo_ncf_fiscal = models.CharField(max_length=3, null=True, blank=True)
    no_formulario = models.IntegerField(null=True, blank=True)

    # Crédito
    plazo_pago = models.IntegerField(default=0)
    no_condicion_pago = models.CharField(max_length=4, null=True, blank=True)
    porc_pronto_pago = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # Referencias
    no_pedido = models.IntegerField(null=True, blank=True)
    ruta = models.CharField(max_length=4, null=True, blank=True)
    no_cuadre = models.IntegerField(null=True, blank=True)

    # Observaciones
    detalle = models.CharField(max_length=256, null=True, blank=True)
    nota = models.CharField(max_length=256, null=True, blank=True)

    # Auditoría
    usuario = models.CharField(max_length=30, null=True, blank=True)
    fecha_sysdate = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'TFAT_FACTURA'
        unique_together = ('no_cia', 'punto', 'tipo_factura', 'no_factura')
        indexes = [
            models.Index(fields=['no_cia', 'punto', 'tipo_factura']),
            models.Index(fields=['no_cliente']),
            models.Index(fields=['fecha']),
            models.Index(fields=['estado']),
        ]

    def __str__(self):
        return f"{self.tipo_factura}-{self.no_factura} ({self.no_cliente})"

    def calcular_totales(self):
        """Recalcula totales desde las líneas"""
        lineas = self.lineas.all()
        self.total_linea = sum(l.cantidad * l.precio for l in lineas)
        self.descuento = sum(l.descuento for l in lineas)
        self.impuesto = sum(l.impuesto for l in lineas)
        self.total_neto = self.total_linea - self.descuento + self.impuesto

    def validar(self):
        """Valida antes de guardar"""
        if self.total_neto <= 0:
            raise ValueError("Total neto debe ser mayor a 0")
        if self.tipo_factura in ['FT', 'FC'] and not self.no_cliente:
            raise ValueError("Cliente requerido para factura")
        if self.tipo_factura in ['FT', 'FC'] and not self.codigo_ncf:
            raise ValueError("Código NCF requerido")

    def save(self, *args, **kwargs):
        self.validar()
        super().save(*args, **kwargs)


class FATFacturaL(models.Model):
    """Líneas de facturas"""

    # PK compuesta
    no_cia = models.CharField(max_length=2)
    punto = models.CharField(max_length=2, default='01')
    tipo_factura = models.CharField(max_length=2)
    no_factura = models.CharField(max_length=7)
    no_linea = models.IntegerField()

    # Relación con encabezado (cascada)
    factura = models.ForeignKey(FATFactura, on_delete=models.CASCADE, related_name='lineas')

    # Producto
    no_produ = models.CharField(max_length=8)  # FK a TINV_PRODUCTO
    descripcion = models.CharField(max_length=256, null=True, blank=True)
    almacen = models.CharField(max_length=2)  # FK a TINV_ALMACEN

    # Cantidades y precios
    cantidad = models.DecimalField(max_digits=10, decimal_places=2)
    precio = models.DecimalField(max_digits=12, decimal_places=4)
    costo = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    precio_de_lista = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)

    # Descuentos e impuestos
    porc_descuento = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    descuento = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    porciento_impuesto = models.DecimalField(max_digits=5, decimal_places=2, default=18.00)
    impuesto = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Total
    monto_neto = models.DecimalField(max_digits=13, decimal_places=2)

    # Detalles adicionales
    empaque = models.IntegerField(default=1)
    cantidad_porciones = models.IntegerField(null=True, blank=True)
    no_lote = models.CharField(max_length=6, null=True, blank=True)
    cantidad_regalia = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Estados
    st_anulado = models.CharField(max_length=1, default='N', choices=[('S', 'Sí'), ('N', 'No')])

    class Meta:
        db_table = 'TFAT_FACTURAL'
        unique_together = ('no_cia', 'punto', 'tipo_factura', 'no_factura', 'no_linea')
        indexes = [
            models.Index(fields=['no_produ']),
            models.Index(fields=['almacen']),
        ]

    def __str__(self):
        return f"{self.no_produ} x{self.cantidad} @ {self.precio}"

    def calcular_neto(self):
        """Calcula monto neto de la línea"""
        subtotal = self.cantidad * self.precio
        desc = subtotal * self.porc_descuento / 100
        imp = (subtotal - desc) * self.porciento_impuesto / 100
        self.descuento = desc
        self.impuesto = imp
        self.monto_neto = subtotal - desc + imp


class FATConduce(models.Model):
    """Conduces (pre-facturas)"""

    no_cia = models.CharField(max_length=2)
    punto = models.CharField(max_length=2, default='01')
    tipo_conduce = models.CharField(max_length=2, choices=[('CO', 'Conducé'), ('CT', 'Cotización')])
    no_conduce = models.CharField(max_length=8)

    no_cliente = models.IntegerField()
    fecha = models.DateField(default=timezone.now)
    vendedor = models.CharField(max_length=4, null=True, blank=True)

    # Referencias a factura si se convirtió
    tipo_factura = models.CharField(max_length=2, null=True, blank=True)
    no_factura = models.CharField(max_length=7, null=True, blank=True)

    # Estados
    st_anulado = models.CharField(max_length=1, default='N', choices=[('S', 'Sí'), ('N', 'No')])
    autorizado = models.CharField(max_length=1, default='N', choices=[('S', 'Sí'), ('N', 'No')])

    # Datos
    tipo_moneda = models.CharField(max_length=2, default='RD')
    tasa_us = models.DecimalField(max_digits=5, decimal_places=2, default=57.50)
    descuento = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    impuesto = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_linea = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_neto = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    detalle = models.CharField(max_length=256, null=True, blank=True)
    usuario = models.CharField(max_length=30, null=True, blank=True)

    class Meta:
        db_table = 'TFAT_CONDUCE'
        unique_together = ('no_cia', 'punto', 'tipo_conduce', 'no_conduce')

    def __str__(self):
        return f"{self.tipo_conduce}-{self.no_conduce}"


class FATCondicionPago(models.Model):
    """Condiciones de pago (plazos)"""

    no_condicion = models.CharField(max_length=4, primary_key=True)
    descripcion = models.CharField(max_length=100)
    dias = models.IntegerField()

    class Meta:
        db_table = 'TFAT_CONDICION_PAGO'

    def __str__(self):
        return f"{self.no_condicion} - {self.descripcion} ({self.dias} días)"


class FATListaPrecio(models.Model):
    """Listas de precio"""

    no_lista = models.CharField(max_length=4, primary_key=True)
    descripcion = models.CharField(max_length=100)
    no_produ = models.CharField(max_length=8)  # FK TINV_PRODUCTO
    precio = models.DecimalField(max_digits=12, decimal_places=4)
    fecha_vigencia = models.DateField()
    activa = models.CharField(max_length=1, default='S', choices=[('S', 'Sí'), ('N', 'No')])

    class Meta:
        db_table = 'TFAT_LISTA_PRECIO'

    def __str__(self):
        return f"{self.no_lista} - {self.no_produ}"


class FATTdocu(models.Model):
    """Tipos de documento con NCF"""

    tipo_doc = models.CharField(max_length=2, primary_key=True)
    descripcion = models.CharField(max_length=100)
    codigo_ncf = models.CharField(max_length=6)  # FC-001, FT-001, etc.
    tipo_transaccion = models.CharField(max_length=1)
    afecta_cxc = models.CharField(max_length=1, default='S')
    activo = models.CharField(max_length=1, default='S')

    # Rangos NCF
    posicion_fijas_ncf = models.CharField(max_length=14, null=True, blank=True)
    ncf_inicial = models.IntegerField()
    ncf_final = models.IntegerField()
    prox_ncf = models.IntegerField()  # Próximo NCF a usar

    class Meta:
        db_table = 'TFAT_TDOCU'

    def __str__(self):
        return f"{self.tipo_doc} - {self.descripcion} (NCF: {self.codigo_ncf})"
