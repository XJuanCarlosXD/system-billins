// Plantilla CHC — Cheque / Comprobante de Caja Chica
// Énfasis: banco, cuenta, beneficiario, monto en letras, firmas autorizadas.
export const chequeChcDefault: any = {
  content: [
    { type: 'WatermarkAnulada', props: { id: 'wm', texto: 'ANULADO', opacity: 0.18, angle: -30, color: '#dc2626' } },
    { type: 'EncabezadoFactura', props: {
      id: 'encab', showLogo: true, colorPrimario: '#3730a3',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 14,
      docBg: '#3730a3', docColor: '#ffffff', showNcf: false, showImpresion: true,
    } },
    { type: 'TextoLibre', props: {
      id: 'banco',
      html: '<div style="margin-top:8px;padding:10px;background:#f0f0ff;border:1px solid #c7c7ff;border-radius:4px"><b>Banco:</b> {{ default doc.banco "—" }} &nbsp;&nbsp; <b>No. Cuenta:</b> {{ default doc.cuenta "—" }}<br/><b>Páguese a la orden de:</b> {{ cliente.nombre }}<br/><b>La cantidad de:</b> RD$ {{ formatMoney totales.total }}<br/><i>({{ default totales.monto_letras "—" }})</i></div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'TextoLibre', props: {
      id: 'concepto',
      html: '<div style="margin-top:6px"><b>Por concepto de:</b> {{ default doc.detalle "—" }}</div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'Spacer', props: { id: 'sp1', height: 4 } },
    { type: 'TablaLineas', props: {
      id: 'tabla',
      columnas: ['codigo', 'descripcion', 'total'],
      zebra: true, headerBg: '#3730a3', headerColor: '#ffffff', fontSize: 9,
    } },
    { type: 'Firmas', props: {
      id: 'fi', cantidad: 3, labels: 'Solicitante|Autorizado|Firma autorizada', lineWidth: 60,
    } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} }, zones: {},
}
