// ACF — Comprobante de Cierre Mensual de Activos Fijos
export const comprobanteCierreAcfDefault: any = {
  content: [
    { type: 'EncabezadoFactura', props: {
      id: 'encab', showLogo: true, colorPrimario: '#1e3a8a',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 15,
      docBg: '#1e3a8a', docColor: '#ffffff', showNcf: false, showImpresion: true,
    } },
    { type: 'TextoLibre', props: {
      id: 'datos',
      html: '<div style="margin-top:8px;padding:12px;background:#eff6ff;border-left:3px solid #1e3a8a;text-align:center;font-size:13px"><b>Cierre del período {{ extra.mes_label }} {{ extra.periodo }}</b></div>',
      fontSize: 12, textAlign: 'center',
    } },
    { type: 'TextoLibre', props: {
      id: 'detalle',
      html: '<div style="margin-top:8px;padding:10px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:4px;font-size:10px"><table style="width:100%"><tr><td><b>Período cerrado:</b></td><td style="text-align:right">{{ doc.periodo }}</td></tr><tr><td>Activos depreciados:</td><td style="text-align:right">{{ extra.activos_depreciados }}</td></tr><tr><td><b>Total depreciado en el mes:</b></td><td style="text-align:right"><b>RD$ {{ formatMoney totales.total }}</b></td></tr><tr><td>Fecha y hora del cierre:</td><td style="text-align:right">{{ extra.fecha_cierre }}</td></tr><tr><td>Usuario que aplicó el cierre:</td><td style="text-align:right">{{ extra.usuario_cierre }}</td></tr></table></div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'TextoLibre', props: {
      id: 'declaracion',
      html: '<div style="margin-top:14px;font-size:10px">Por la presente se deja constancia del cierre contable del módulo de Activos Fijos correspondiente al período arriba indicado. Posteriores movimientos quedarán registrados en el siguiente período.</div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'Firmas', props: { id: 'fi', cantidad: 2, labels: 'Contabilidad|Aprobado por', lineWidth: 70 } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} }, zones: {},
}
