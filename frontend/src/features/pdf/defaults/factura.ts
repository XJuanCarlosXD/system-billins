// Plantilla default para Factura A4 — replica el layout del legacy ReportLab moderno:
// [Logo + Empresa] | [Tarjeta documento (tipo, no, NCF)]   ← 2 columnas
// [Panel cliente 2x4] + [Panel fiscal 4 columnas]          ← grid info
// [Tabla líneas]
// [Bloque totales]
// [Nota]
// [Firmas: Recibido por / Entregado por]
// [Footer]
export const facturaDefault: any = {
  content: [
    { type: 'WatermarkAnulada', props: { id: 'watermark-1', texto: 'ANULADA', opacity: 0.18, angle: -30, color: '#dc2626' } },
    { type: 'EncabezadoFactura', props: {
      id: 'encab',
      showLogo: true, colorPrimario: '#0F172A',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 15,
      docBg: '#0F172A', docColor: '#ffffff', showNcf: true, showImpresion: true,
    } },
    { type: 'PanelInfoFactura', props: {
      id: 'panel',
      showCliente: true, showRnc: true, showDireccion: true, showVendedor: true,
      showFecha: true, showCondicion: true, showPlazo: true,
      showTipoNcf: true, showFormaPago: true, showEstado: true,
    } },
    { type: 'TablaLineas', props: {
      id: 'tabla',
      columnas: ['codigo', 'descripcion', 'cantidad', 'precio', 'descuento', 'itbis', 'total'],
      zebra: true, headerBg: '#0F172A', headerColor: '#ffffff', fontSize: 9,
    } },
    { type: 'BloqueTotales', props: {
      id: 'totales',
      showSubtotal: true, showDescuento: true, showItbis: true, showPropina: true,
      showOtros: false, showMontoLetras: true, align: 'right', colorTotal: '#0F172A',
    } },
    { type: 'NotaDetalle', props: { id: 'nota', titulo: 'Nota:', mostrarSiVacio: false } },
    { type: 'Firmas', props: { id: 'firmas', cantidad: 2, labels: 'Recibido por|Entregado por', lineWidth: 80 } },
    { type: 'FooterEmpresa', props: {
      id: 'footer',
      texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }} | Tel: {{ cia.telefono }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} },
  zones: {},
}
