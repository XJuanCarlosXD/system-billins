// Plantilla default para el Cuadre de Caja (familia 'reporte').
// Header empresa con logo + Header reporte + bloque cuadre + footer empresa.
// El bloque cuadre se alimenta de payload.extra (resumen_pago, por_ncf,
// por_ncf_forma_pago, facturas) y la fecha viene de reporte.filtros.

export const cuadreCajaDefault: any = {
  content: [
    { type: 'HeaderEmpresa', props: {
      id: 'he', showLogo: true, logoAlign: 'left', colorPrimario: '#0F172A',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 14,
    } },
    { type: 'HeaderReporte', props: {
      id: 'hr', showFiltros: true, showFechaGeneracion: true, colorPrimario: '#0F172A',
    } },
    { type: 'BloqueCuadreCaja', props: {
      id: 'cc',
      showResumenPago: true,
      // Quitado del default: el por_ncf se cubre con la matriz NCF×forma_pago.
      showPorNcf: false,
      // Default OFF — el switch "Ver detalle de NCF" en la pantalla envía
      // show_ncf_detail=1 que prende la matriz vía extra.show_ncf_detail.
      showMatrizNcfFormaPago: false,
      // Detalle de facturas off por default — solo si el usuario activa el
      // toggle "Incluir detalle" o lo prende en la plantilla.
      showDetalleFacturas: false,
      colorTitulo: '#0F172A',
      fontSize: 9,
    } },
    { type: 'Firmas', props: {
      id: 'fi', cantidad: 2, labels: 'Cajero / Usuario|Supervisor / Encargado', lineWidth: 80,
    } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }}',
      showPaginacion: true, showFechaGeneracion: false, color: '#777777',
    } },
  ],
  root: { props: {} },
  zones: {},
}
