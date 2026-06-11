// Plantilla CXC — Recibo de Cobro
// Énfasis: nombre cliente, saldo restante, formato comprobante de pago.
export const reciboCobroDefault: any = {
  content: [
    { type: 'WatermarkAnulada', props: { id: 'wm', texto: 'ANULADO', opacity: 0.18, angle: -30, color: '#dc2626' } },
    { type: 'EncabezadoFactura', props: {
      id: 'encab', showLogo: true, colorPrimario: '#065f46',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 15,
      docBg: '#065f46', docColor: '#ffffff', showNcf: false, showImpresion: true,
    } },
    { type: 'TextoLibre', props: {
      id: 'recibido_de',
      html: '<div style="margin-top:8px"><b>Recibido de:</b> {{ cliente.nombre }}<br/><b>RNC/Cédula:</b> {{ default cliente.rnc "—" }}</div>',
      fontSize: 11, textAlign: 'left',
    } },
    { type: 'TextoLibre', props: {
      id: 'monto_letras',
      html: '<div style="margin-top:6px;padding:8px;background:#f0fdf4;border-left:3px solid #065f46"><b>La cantidad de:</b> RD$ {{ formatMoney totales.total }}<br/><i>({{ default totales.monto_letras "—" }})</i></div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'TextoLibre', props: {
      id: 'concepto',
      html: '<div style="margin-top:6px"><b>Por concepto de:</b> {{ default doc.detalle "—" }}</div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'Spacer', props: { id: 'sp1', height: 6 } },
    { type: 'TablaLineas', props: {
      id: 'tabla',
      columnas: ['codigo', 'descripcion', 'total'],
      zebra: true, headerBg: '#065f46', headerColor: '#ffffff', fontSize: 9,
    } },
    { type: 'TextoLibre', props: {
      id: 'saldo',
      html: '<div style="margin-top:8px;text-align:right;font-weight:700">Saldo pendiente: RD$ {{ formatMoney extra.saldo }}</div>',
      fontSize: 11, textAlign: 'right',
    } },
    { type: 'Firmas', props: { id: 'fi', cantidad: 2, labels: 'Recibido por|Entregado por', lineWidth: 70 } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} }, zones: {},
}
