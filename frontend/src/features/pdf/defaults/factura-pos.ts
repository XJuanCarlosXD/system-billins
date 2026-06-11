// Plantilla default para Factura POS 80mm — ticket térmico.
export const facturaPosDefault: any = {
  content: [
    { type: 'HeaderEmpresa', props: {
      id: 'he', showLogo: true, logoAlign: 'center', colorPrimario: '#000000',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 11,
    } },
    { type: 'SeparadorHR', props: { id: 'hr1', thickness: 1, color: '#000000', margin: 2 } },
    { type: 'TextoLibre', props: {
      id: 't1',
      html: '<div style="font-size:11px;font-weight:700;text-align:center">{{ doc.tipo_label }}</div><div style="font-size:10px;text-align:center">{{ doc.numero_display }}</div><div style="font-size:9px;text-align:center">NCF: {{ doc.ncf_dgi }}</div><div style="font-size:9px">Fecha: {{ formatDate doc.fecha }}</div><div style="font-size:9px">Cliente: {{ cliente.nombre }}</div><div style="font-size:9px">RNC: {{ cliente.rnc }}</div>',
      fontSize: 9, textAlign: 'left',
    } },
    { type: 'SeparadorHR', props: { id: 'hr2', thickness: 1, color: '#000000', margin: 2 } },
    { type: 'TablaLineas', props: {
      id: 'tabla',
      columnas: ['descripcion', 'cantidad', 'precio', 'total'],
      zebra: false, headerBg: '#ffffff', headerColor: '#000000', fontSize: 8,
    } },
    { type: 'SeparadorHR', props: { id: 'hr3', thickness: 1, color: '#000000', margin: 2 } },
    { type: 'BloqueTotales', props: {
      id: 'tot', showSubtotal: true, showDescuento: true, showItbis: true, showPropina: true,
      showOtros: false, showMontoLetras: false, align: 'right', colorTotal: '#000000',
    } },
    { type: 'QRCode', props: { id: 'qr', contenido: '{{ doc.ncf_dgi }}', size: 80, align: 'center' } },
    { type: 'TextoLibre', props: {
      id: 'pie',
      html: '<div style="font-size:8px;text-align:center;margin-top:4px">Gracias por su compra</div>',
      fontSize: 8, textAlign: 'center',
    } },
  ],
  root: { props: {} },
  zones: {},
}
