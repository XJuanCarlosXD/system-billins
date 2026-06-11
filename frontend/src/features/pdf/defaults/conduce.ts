export const conduceDefault: any = {
  content: [
    { type: 'WatermarkAnulada', props: { id: 'watermark', texto: 'ANULADA', opacity: 0.18, angle: -30, color: '#dc2626' } },
    { type: 'HeaderEmpresa', props: {
      id: 'he', showLogo: true, logoAlign: 'left', colorPrimario: '#0F172A',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 16,
    } },
    { type: 'HeaderDocumento', props: {
      id: 'hd', showNcf: false, showFechaVenc: false, showImpresion: true,
      bgColor: '#475569', textColor: '#ffffff',
    } },
    { type: 'Spacer', props: { id: 'sp1', height: 6 } },
    { type: 'BloqueCliente', props: {
      id: 'cl', columnas: 2,
      showNombre: true, showRnc: true, showDireccion: true,
      showTelefono: false, showEmail: false, showTipoNcf: false, showCondicion: true, showVendedor: true,
    } },
    { type: 'Spacer', props: { id: 'sp2', height: 6 } },
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
