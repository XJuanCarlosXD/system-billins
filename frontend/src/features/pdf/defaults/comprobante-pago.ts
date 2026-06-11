// Plantilla CXP — Comprobante de Pago
// Énfasis: proveedor, NCF, fechaVenc, distribución contable, saldo.
export const comprobantePagoDefault: any = {
  content: [
    { type: 'WatermarkAnulada', props: { id: 'wm', texto: 'ANULADO', opacity: 0.18, angle: -30, color: '#dc2626' } },
    { type: 'EncabezadoFactura', props: {
      id: 'encab', showLogo: true, colorPrimario: '#9a3412',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 15,
      docBg: '#9a3412', docColor: '#ffffff', showNcf: true, showImpresion: true,
    } },
    { type: 'TextoLibre', props: {
      id: 'proveedor',
      html: '<div style="margin-top:8px;padding:8px;background:#fff7ed;border-left:3px solid #9a3412"><b>Proveedor:</b> {{ default proveedor.nombre cliente.nombre }}<br/><b>RNC:</b> {{ default proveedor.rnc cliente.rnc }}<br/><b>NCF:</b> {{ doc.ncf_dgi }}<br/><b>Fecha:</b> {{ formatDate doc.fecha }} &nbsp; <b>Vence:</b> {{ formatDate doc.fecha_venc }}<br/><b>Forma pago:</b> {{ doc.forma_pago }}</div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'Spacer', props: { id: 'sp1', height: 6 } },
    { type: 'TablaLineas', props: {
      id: 'tabla',
      columnas: ['codigo', 'descripcion', 'precio', 'total'],
      zebra: true, headerBg: '#9a3412', headerColor: '#ffffff', fontSize: 9,
    } },
    { type: 'BloqueTotales', props: {
      id: 'tot', showSubtotal: true, showDescuento: false, showItbis: true,
      showPropina: false, showOtros: true, showMontoLetras: true,
      align: 'right', colorTotal: '#9a3412',
    } },
    { type: 'TextoLibre', props: {
      id: 'saldo',
      html: '<div style="margin-top:6px;text-align:right;font-weight:700;font-size:12px">Saldo pendiente: RD$ {{ formatMoney extra.saldo }}</div>',
      fontSize: 11, textAlign: 'right',
    } },
    { type: 'Firmas', props: { id: 'fi', cantidad: 3, labels: 'Solicitado|Autorizado|Recibido', lineWidth: 60 } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} }, zones: {},
}
