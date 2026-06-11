// Plantilla default para Factura A4. Se aplica si TFAT_PLANTILLA_PDF.DEFINICION_JSON es NULL.
export const facturaDefault: any = {
  content: [
    { type: 'WatermarkAnulada', props: { id: 'watermark-1', texto: 'ANULADA', opacity: 0.18, angle: -30, color: '#dc2626' } },
    { type: 'HeaderEmpresa', props: {
      id: 'header-empresa', showLogo: true, logoAlign: 'left', colorPrimario: '#0F172A',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 16,
    } },
    { type: 'HeaderDocumento', props: {
      id: 'header-doc', showNcf: true, showFechaVenc: false, showImpresion: true,
      bgColor: '#0F172A', textColor: '#ffffff',
    } },
    { type: 'Spacer', props: { id: 'sp-1', height: 6 } },
    { type: 'BloqueCliente', props: {
      id: 'cliente', columnas: 2,
      showNombre: true, showRnc: true, showDireccion: true,
      showTelefono: false, showEmail: false, showTipoNcf: true, showCondicion: true, showVendedor: true,
    } },
    { type: 'Spacer', props: { id: 'sp-2', height: 6 } },
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
