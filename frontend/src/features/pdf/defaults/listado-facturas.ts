export const listadoFacturasDefault: any = {
  content: [
    { type: 'HeaderEmpresa', props: {
      id: 'he', showLogo: true, logoAlign: 'left', colorPrimario: '#0F172A',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 14,
    } },
    { type: 'HeaderReporte', props: {
      id: 'hr', showFiltros: true, showFechaGeneracion: true, colorPrimario: '#0F172A',
    } },
    { type: 'TablaReporte', props: {
      id: 'tr',
      columnasJson: JSON.stringify(
        [
          { campo: 'no_factura', label: 'No.', align: 'left' },
          { campo: 'fecha', label: 'Fecha', align: 'left', format: 'date' },
          { campo: 'cliente', label: 'Cliente', align: 'left' },
          { campo: 'ncf_dgi', label: 'NCF', align: 'left' },
          { campo: 'estado', label: 'Est', align: 'center' },
          { campo: 'total', label: 'Total', align: 'right', format: 'money' },
        ],
        null, 2,
      ),
      zebra: true, headerBg: '#0F172A', headerColor: '#ffffff', fontSize: 9,
    } },
    { type: 'FooterReporte', props: {
      id: 'fr', showCantidad: true, showTotal: true, colorPrimario: '#0F172A',
    } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }}',
      showPaginacion: true, showFechaGeneracion: false, color: '#777777',
    } },
  ],
  root: { props: {} },
  zones: {},
}
