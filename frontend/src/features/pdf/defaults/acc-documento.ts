// Plantilla ACC — Documento de Caja Chica (estilo DocumentoSimple, ver skill
// sigaft-pdf-simple-design: sin barra oscura, sin zebra, sin paneles de color).
export const accDocumentoDefault: any = {
  content: [
    { type: 'WatermarkAnulada', props: { id: 'wm', texto: 'ANULADO', opacity: 0.18, angle: -30, color: '#dc2626' } },
    { type: 'DocumentoSimple', props: {
      id: 'doc',
      columnas: 'codigo,descripcion,total',
      firmaIzq: 'Entregado por',
      firmaDer: 'Recibido por',
      mostrarAlmacen: false,
      montoLetras: false,
      introHtml: '',
      pieHtml: '',
    } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} }, zones: {},
}
