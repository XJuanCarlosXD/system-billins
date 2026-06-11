// Plantilla ACC — Documento de Caja Chica
// Énfasis: beneficiario, NCF, distribución contable.
export const accDocumentoDefault: any = {
  content: [
    { type: 'WatermarkAnulada', props: { id: 'wm', texto: 'ANULADO', opacity: 0.18, angle: -30, color: '#dc2626' } },
    { type: 'EncabezadoFactura', props: {
      id: 'encab', showLogo: true, colorPrimario: '#7c2d12',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 14,
      docBg: '#7c2d12', docColor: '#ffffff', showNcf: true, showImpresion: true,
    } },
    { type: 'TextoLibre', props: {
      id: 'bene',
      html: '<div style="margin-top:8px;padding:8px;background:#fef3e7;border-left:3px solid #7c2d12"><b>Beneficiario:</b> {{ cliente.nombre }}<br/><b>Fecha:</b> {{ formatDate doc.fecha }}<br/><b>Tipo:</b> {{ doc.tipo_label }}<br/><b>Descripción:</b> {{ default doc.detalle "—" }}</div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'Spacer', props: { id: 'sp1', height: 6 } },
    { type: 'TablaLineas', props: {
      id: 'tabla',
      columnas: ['codigo', 'descripcion', 'total'],
      zebra: true, headerBg: '#7c2d12', headerColor: '#ffffff', fontSize: 9,
    } },
    { type: 'BloqueTotales', props: {
      id: 'tot', showSubtotal: true, showDescuento: false, showItbis: false,
      showPropina: false, showOtros: false, showMontoLetras: true,
      align: 'right', colorTotal: '#7c2d12',
    } },
    { type: 'Firmas', props: { id: 'fi', cantidad: 3, labels: 'Solicitado|Autorizado|Recibido', lineWidth: 60 } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} }, zones: {},
}
