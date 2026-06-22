// ACF — Listado de Depreciación Mensual aplicada
export const listadoDepreciacionAcfDefault: any = {
  content: [
    { type: 'HeaderEmpresa', props: {
      id: 'he', showLogo: true, logoAlign: 'left', colorPrimario: '#1e3a8a',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 14,
    } },
    { type: 'HeaderReporte', props: {
      id: 'hr', showFiltros: true, showFechaGeneracion: true, colorPrimario: '#1e3a8a',
    } },
    { type: 'TablaReporte', props: {
      id: 'tr',
      columnasJson: JSON.stringify(
        [
          { campo: 'no_activo', label: 'No.', align: 'left' },
          { campo: 'descripcion', label: 'Descripción', align: 'left' },
          { campo: 'grupo', label: 'Grupo', align: 'left' },
          { campo: 'departamento', label: 'Depto', align: 'left' },
          { campo: 'valor_original', label: 'Valor Orig.', align: 'right', format: 'money' },
          { campo: 'depre_mes', label: 'Cuota Mes', align: 'right', format: 'money' },
          { campo: 'depre_acumu', label: 'Acumulada', align: 'right', format: 'money' },
          { campo: 'valor_libro', label: 'V. Libros', align: 'right', format: 'money' },
        ],
        null, 2,
      ),
      zebra: true, headerBg: '#1e3a8a', headerColor: '#ffffff', fontSize: 8,
    } },
    { type: 'FooterReporte', props: {
      id: 'fr', showCantidad: true, showTotal: true, totalLabel: 'Total depreciado en el mes',
      colorPrimario: '#1e3a8a',
    } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }}',
      showPaginacion: true, showFechaGeneracion: false, color: '#777777',
    } },
  ],
  root: { props: {} },
  zones: {},
}
