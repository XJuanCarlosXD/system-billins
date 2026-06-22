// ACF — Valuación Contable de Activos Fijos
export const valuacionAcfDefault: any = {
  content: [
    { type: 'HeaderEmpresa', props: {
      id: 'he', showLogo: true, logoAlign: 'left', colorPrimario: '#0f766e',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 14,
    } },
    { type: 'HeaderReporte', props: {
      id: 'hr', showFiltros: true, showFechaGeneracion: true, colorPrimario: '#0f766e',
    } },
    { type: 'TextoLibre', props: {
      id: 'kpi',
      html: '<div style="margin-top:10px;padding:14px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:6px"><table style="width:100%;font-size:11px"><tr><td><b>Cantidad de activos:</b></td><td style="text-align:right">{{ totales.cantidad }}</td><td><b>Valor original:</b></td><td style="text-align:right">RD$ {{ formatMoney totales.valor_original }}</td></tr><tr><td><b>Mejoras:</b></td><td style="text-align:right">RD$ {{ formatMoney totales.mejoras }}</td><td><b>Revalorización:</b></td><td style="text-align:right">RD$ {{ formatMoney totales.revalorizacion }}</td></tr><tr><td><b>Depreciación acumulada:</b></td><td style="text-align:right;color:#b45309">RD$ {{ formatMoney totales.depre_acumu }}</td><td><b>Valor en libros:</b></td><td style="text-align:right;color:#0f766e;font-weight:bold">RD$ {{ formatMoney totales.valor_libros }}</td></tr></table></div>',
      fontSize: 11, textAlign: 'left',
    } },
    { type: 'TextoLibre', props: {
      id: 'subtitulo',
      html: '<div style="margin-top:14px;font-weight:bold;color:#0f766e">Distribución por grupo</div>',
      fontSize: 11, textAlign: 'left',
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
      zebra: true, headerBg: '#0f766e', headerColor: '#ffffff', fontSize: 9,
    } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} },
  zones: {},
}
