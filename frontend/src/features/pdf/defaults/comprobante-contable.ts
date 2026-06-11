// Plantilla CNT — Comprobante Contable (Asiento)
// Énfasis: período, débitos/créditos cuadrados, distribución por cuenta.
export const comprobanteContableDefault: any = {
  content: [
    { type: 'WatermarkAnulada', props: { id: 'wm', texto: 'ANULADO', opacity: 0.18, angle: -30, color: '#dc2626' } },
    { type: 'EncabezadoFactura', props: {
      id: 'encab', showLogo: true, colorPrimario: '#581c87',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 15,
      docBg: '#581c87', docColor: '#ffffff', showNcf: false, showImpresion: true,
    } },
    { type: 'TextoLibre', props: {
      id: 'header',
      html: '<div style="margin-top:8px;padding:8px;background:#faf5ff;border-left:3px solid #581c87"><b>Período:</b> {{ default doc.periodo "—" }}<br/><b>Fecha:</b> {{ formatDate doc.fecha }}<br/><b>Estado:</b> {{ doc.estado }}<br/><b>Detalle:</b> {{ default doc.detalle "—" }}</div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'Spacer', props: { id: 'sp1', height: 4 } },
    { type: 'TablaLineas', props: {
      id: 'tabla',
      columnas: ['codigo', 'descripcion', 'almacen', 'debito', 'credito'],
      zebra: true, headerBg: '#581c87', headerColor: '#ffffff', fontSize: 9,
    } },
    { type: 'TextoLibre', props: {
      id: 'totales',
      html: '<table style="width:100%;margin-top:8px;border-top:1px solid #581c87;padding-top:6px"><tr><td><b>Total Débitos:</b></td><td style="text-align:right"><b>RD$ {{ formatMoney extra.debitos }}</b></td><td style="width:20px"></td><td><b>Total Créditos:</b></td><td style="text-align:right"><b>RD$ {{ formatMoney extra.creditos }}</b></td></tr></table>',
      fontSize: 11, textAlign: 'left',
    } },
    { type: 'Firmas', props: { id: 'fi', cantidad: 3, labels: 'Preparado por|Revisado por|Autorizado por', lineWidth: 60 } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }} | Comprobante #{{ doc.numero_display }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} }, zones: {},
}
