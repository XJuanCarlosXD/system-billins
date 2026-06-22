// ACF — Listado de Activos Fijos (reemplaza Facf501.rep legacy)
export const listadoActivosAcfDefault: any = {
  content: [
    { type: 'HeaderEmpresa', props: {
      id: 'he', showLogo: true, logoAlign: 'left', colorPrimario: '#155e75',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 14,
    } },
    { type: 'HeaderReporte', props: {
      id: 'hr', showFiltros: true, showFechaGeneracion: true, colorPrimario: '#155e75',
    } },
    { type: 'TablaReporte', props: {
      id: 'tr',
      columnasJson: JSON.stringify(
        [
          { campo: 'no_activo', label: 'No.', align: 'left' },
          { campo: 'descripcion', label: 'Descripción', align: 'left' },
          { campo: 'grupo', label: 'Grupo', align: 'left' },
          { campo: 'departamento', label: 'Depto', align: 'left' },
          { campo: 'fecha_compra', label: 'F. Compra', align: 'left', format: 'date' },
          { campo: 'valor_original', label: 'Valor', align: 'right', format: 'money' },
          { campo: 'depre_acumu', label: 'Depre. Acum.', align: 'right', format: 'money' },
          { campo: 'valor_libros', label: 'V. Libros', align: 'right', format: 'money' },
          { campo: 'status', label: 'Est', align: 'center' },
        ],
        null, 2,
      ),
      zebra: true, headerBg: '#155e75', headerColor: '#ffffff', fontSize: 8,
    } },
    { type: 'FooterReporte', props: {
      id: 'fr', showCantidad: true, showTotal: true, totalLabel: 'Total valor en libros',
      colorPrimario: '#155e75',
    } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }}',
      showPaginacion: true, showFechaGeneracion: false, color: '#777777',
    } },
  ],
  root: { props: {} },
  zones: {},
}
