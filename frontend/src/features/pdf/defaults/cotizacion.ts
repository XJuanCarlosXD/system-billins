export const cotizacionDefault: any = {
  content: [
    { type: 'HeaderEmpresa', props: {
      id: 'he', showLogo: true, logoAlign: 'center', colorPrimario: '#1e40af',
      showRnc: true, showTelefono: true, showEmail: true, showDireccion: true, razonSize: 18,
    } },
    { type: 'HeaderDocumento', props: {
      id: 'hd', showNcf: false, showFechaVenc: true, showImpresion: false,
      bgColor: '#1e40af', textColor: '#ffffff',
    } },
    { type: 'TextoLibre', props: {
      id: 'intro',
      html: '<p>Estimado(a) <b>{{ cliente.nombre }}</b>,</p><p>Por la presente cotización le presentamos nuestra mejor oferta para los siguientes productos y/o servicios:</p>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'BloqueCliente', props: {
      id: 'cl', columnas: 2,
      showNombre: true, showRnc: true, showDireccion: true,
      showTelefono: true, showEmail: true, showTipoNcf: false, showCondicion: true, showVendedor: true,
    } },
    { type: 'Spacer', props: { id: 'sp', height: 6 } },
    { type: 'TablaLineas', props: {
      id: 'tabla',
      columnas: ['codigo', 'descripcion', 'cantidad', 'precio', 'itbis', 'total'],
      zebra: true, headerBg: '#1e40af', headerColor: '#ffffff', fontSize: 9,
    } },
    { type: 'BloqueTotales', props: {
      id: 'tot',
      showSubtotal: true, showDescuento: true, showItbis: true, showPropina: false,
      showOtros: false, showMontoLetras: true, align: 'right', colorTotal: '#1e40af',
    } },
    { type: 'TextoLibre', props: {
      id: 'condiciones',
      html: '<p><b>Validez:</b> 15 días a partir de la fecha de emisión.<br/><b>Condiciones de pago:</b> {{ doc.condicion_pago }}</p>',
      fontSize: 9, textAlign: 'left',
    } },
    { type: 'Firmas', props: { id: 'fi', cantidad: 1, labels: 'Aprobado por', lineWidth: 60 } },
    { type: 'FooterEmpresa', props: {
      id: 'fo',
      texto: '{{ cia.razon_social }} | Cotización generada en sistema SIGAFT',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} },
  zones: {},
}
