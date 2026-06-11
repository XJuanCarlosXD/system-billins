export const conduceDefault: any = {
  content: [
    { type: 'WatermarkAnulada', props: { id: 'watermark', texto: 'ANULADA', opacity: 0.18, angle: -30, color: '#dc2626' } },
    { type: 'EncabezadoFactura', props: {
      id: 'encab',
      showLogo: true, colorPrimario: '#475569',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 15,
      docBg: '#475569', docColor: '#ffffff', showNcf: false, showImpresion: true,
    } },
    { type: 'PanelInfoFactura', props: {
      id: 'panel',
      showCliente: true, showRnc: true, showDireccion: true, showVendedor: true,
      showFecha: true, showCondicion: true, showPlazo: true,
      showTipoNcf: false, showFormaPago: false, showEstado: true,
    } },
    { type: 'TablaLineas', props: {
      id: 'tabla',
      columnas: ['codigo', 'descripcion', 'cantidad', 'precio', 'descuento', 'total'],
      zebra: true, headerBg: '#475569', headerColor: '#ffffff', fontSize: 9,
    } },
    { type: 'BloqueTotales', props: {
      id: 'tot',
      showSubtotal: true, showDescuento: true, showItbis: true, showPropina: false,
      showOtros: false, showMontoLetras: true, align: 'right', colorTotal: '#475569',
    } },
    { type: 'NotaDetalle', props: { id: 'nota', titulo: 'Detalle:', mostrarSiVacio: false } },
    { type: 'Firmas', props: { id: 'fi', cantidad: 2, labels: 'Recibido por|Entregado por', lineWidth: 80 } },
    { type: 'FooterEmpresa', props: {
      id: 'fo',
      texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} },
  zones: {},
}
