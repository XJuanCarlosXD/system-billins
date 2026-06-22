// ACF — Comprobante de Retiro de Activo Fijo
export const comprobanteRetiroAcfDefault: any = {
  content: [
    { type: 'EncabezadoFactura', props: {
      id: 'encab', showLogo: true, colorPrimario: '#b45309',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 15,
      docBg: '#b45309', docColor: '#ffffff', showNcf: false, showImpresion: true,
    } },
    { type: 'TextoLibre', props: {
      id: 'datos',
      html: '<div style="margin-top:8px;padding:10px;background:#fff7ed;border-left:3px solid #b45309"><b>No. Activo:</b> {{ doc.no_activo }}<br/><b>Descripción:</b> {{ doc.descripcion_activo }}<br/><b>Serie / Placa:</b> {{ default doc.serie "—" }}<br/><b>Departamento:</b> {{ default doc.departamento "—" }} &nbsp; <b>Responsable:</b> {{ default doc.responsable "—" }}<br/><b>Fecha de Retiro:</b> {{ formatDate doc.fecha }} &nbsp; <b>No. Documento:</b> {{ doc.numero_display }}</div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'TextoLibre', props: {
      id: 'valores',
      html: '<div style="margin-top:8px;padding:10px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:4px"><table style="width:100%"><tr><td><b>Valor Original:</b></td><td style="text-align:right">RD$ {{ formatMoney extra.valor_original }}</td></tr><tr><td>Depreciación Acumulada:</td><td style="text-align:right">RD$ {{ formatMoney extra.depre_acumu }}</td></tr><tr><td><b>Valor en Libros (al retiro):</b></td><td style="text-align:right"><b>RD$ {{ formatMoney totales.total }}</b></td></tr><tr><td>Cuenta Contable:</td><td style="text-align:right">{{ doc.cuenta_contable }}</td></tr></table></div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'TextoLibre', props: {
      id: 'motivo',
      html: '<div style="margin-top:10px;padding:8px;border:1px dashed #94a3b8;border-radius:4px;font-size:10px"><b>Motivo:</b> {{ doc.detalle }}</div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'TextoLibre', props: {
      id: 'declaracion',
      html: '<div style="margin-top:12px;font-size:10px">Por la presente se hace constar que el activo descrito ha sido dado de baja del inventario de activos fijos de la empresa.</div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'Firmas', props: { id: 'fi', cantidad: 2, labels: 'Aprobado por|Contabilidad', lineWidth: 70 } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} }, zones: {},
}
