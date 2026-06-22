// ACF — Distribución de activos por departamento
export const activosPorDepartamentoAcfDefault: any = {
  content: [
    { type: 'HeaderEmpresa', props: {
      id: 'he', showLogo: true, logoAlign: 'left', colorPrimario: '#0369a1',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 14,
    } },
    { type: 'HeaderReporte', props: {
      id: 'hr', showFiltros: true, showFechaGeneracion: true, colorPrimario: '#0369a1',
    } },
    { type: 'TablaReporte', props: {
      id: 'tr',
      columnasJson: JSON.stringify(
        [
          { campo: 'departamento', label: 'Departamento', align: 'left' },
          { campo: 'cantidad', label: 'Cant.', align: 'right' },
          { campo: 'valor_original', label: 'V. Original', align: 'right', format: 'money' },
          { campo: 'depre_acumu', label: 'Depre. Acum.', align: 'right', format: 'money' },
          { campo: 'valor_libros', label: 'V. Libros', align: 'right', format: 'money' },
        ],
        null, 2,
      ),
      zebra: true, headerBg: '#0369a1', headerColor: '#ffffff', fontSize: 9,
    } },
    { type: 'FooterReporte', props: {
      id: 'fr', showCantidad: true, showTotal: true, totalLabel: 'Total valor en libros',
      colorPrimario: '#0369a1',
    } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }}',
      showPaginacion: true, showFechaGeneracion: false, color: '#777777',
    } },
  ],
  root: { props: {} },
  zones: {},
}
