// ACF — Distribución de activos por grupo
export const activosPorGrupoAcfDefault: any = {
  content: [
    { type: 'HeaderEmpresa', props: {
      id: 'he', showLogo: true, logoAlign: 'left', colorPrimario: '#7c3aed',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 14,
    } },
    { type: 'HeaderReporte', props: {
      id: 'hr', showFiltros: true, showFechaGeneracion: true, colorPrimario: '#7c3aed',
    } },
    { type: 'TablaReporte', props: {
      id: 'tr',
      columnasJson: JSON.stringify(
        [
          { campo: 'grupo', label: 'Grupo', align: 'left' },
          { campo: 'cantidad', label: 'Cantidad', align: 'right' },
        ],
        null, 2,
      ),
      zebra: true, headerBg: '#7c3aed', headerColor: '#ffffff', fontSize: 10,
    } },
    { type: 'FooterReporte', props: {
      id: 'fr', showCantidad: true, showTotal: false, colorPrimario: '#7c3aed',
    } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }}',
      showPaginacion: true, showFechaGeneracion: false, color: '#777777',
    } },
  ],
  root: { props: {} },
  zones: {},
}
