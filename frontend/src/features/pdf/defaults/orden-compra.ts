// Plantilla ODC — Orden de Compra
// Énfasis: proveedor, fecha entrega, condiciones, líneas con cantidad pedida vs costo.
export const ordenCompraDefault: any = {
  content: [
    { type: 'WatermarkAnulada', props: { id: 'wm', texto: 'ANULADA', opacity: 0.18, angle: -30, color: '#dc2626' } },
    { type: 'EncabezadoFactura', props: {
      id: 'encab', showLogo: true, colorPrimario: '#1e40af',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 15,
      docBg: '#1e40af', docColor: '#ffffff', showNcf: false, showImpresion: true,
    } },
    { type: 'TextoLibre', props: {
      id: 'intro',
      html: '<div style="margin-top:8px;padding:8px;background:#eff6ff;border-left:3px solid #1e40af"><b>Proveedor:</b> {{ default proveedor.nombre cliente.nombre }}<br/><b>RNC:</b> {{ default proveedor.rnc "—" }}<br/><b>Fecha emisión:</b> {{ formatDate doc.fecha }} &nbsp;&nbsp; <b>Fecha entrega solicitada:</b> {{ formatDate doc.fecha_venc }}<br/><b>Tipo orden:</b> {{ default doc.tipo "—" }} &nbsp; <b>Estado:</b> {{ doc.estado }}</div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'Spacer', props: { id: 'sp1', height: 6 } },
    { type: 'TablaLineas', props: {
      id: 'tabla',
      columnas: ['codigo', 'descripcion', 'cantidad', 'unidad', 'precio', 'descuento', 'itbis', 'total'],
      zebra: true, headerBg: '#1e40af', headerColor: '#ffffff', fontSize: 9,
    } },
    { type: 'BloqueTotales', props: {
      id: 'tot', showSubtotal: true, showDescuento: true, showItbis: true,
      showPropina: false, showOtros: false, showMontoLetras: false,
      align: 'right', colorTotal: '#1e40af',
    } },
    { type: 'TextoLibre', props: {
      id: 'condiciones',
      html: '<div style="margin-top:8px;font-size:9px;color:#475569"><b>Condiciones:</b> Los precios incluyen ITBIS. El proveedor debe entregar copia firmada de esta orden con la mercancía. Cualquier diferencia debe reportarse en 48 horas.</div>',
      fontSize: 9, textAlign: 'left',
    } },
    { type: 'Firmas', props: { id: 'fi', cantidad: 3, labels: 'Solicitado por|Autorizado por|Recibido por', lineWidth: 60 } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }} | Tel: {{ cia.telefono }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} }, zones: {},
}
