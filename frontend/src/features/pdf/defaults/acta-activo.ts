// Plantilla ACF — Acta de Activo Fijo
// Énfasis: identificación física del activo, responsable, ubicación, valor.
export const actaActivoDefault: any = {
  content: [
    { type: 'EncabezadoFactura', props: {
      id: 'encab', showLogo: true, colorPrimario: '#155e75',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 15,
      docBg: '#155e75', docColor: '#ffffff', showNcf: false, showImpresion: true,
    } },
    { type: 'TextoLibre', props: {
      id: 'datos',
      html: '<div style="margin-top:8px;padding:10px;background:#ecfeff;border-left:3px solid #155e75"><b>Activo:</b> {{ doc.numero_display }}<br/><b>Descripción:</b> {{ doc.detalle }}<br/><b>Grupo:</b> {{ default doc.grupo "—" }} &nbsp; <b>Marca:</b> {{ default doc.marca "—" }} &nbsp; <b>Modelo:</b> {{ default doc.modelo "—" }}<br/><b>Serial:</b> {{ default doc.serial "—" }}<br/><b>Ubicación:</b> {{ default doc.ubicacion "—" }}<br/><b>Responsable:</b> {{ cliente.nombre }}<br/><b>Fecha de Alta:</b> {{ formatDate doc.fecha }} &nbsp; <b>Estado:</b> {{ doc.estado }}</div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'TextoLibre', props: {
      id: 'valores',
      html: '<div style="margin-top:8px;padding:10px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:4px"><table style="width:100%"><tr><td><b>Valor de Compra:</b></td><td style="text-align:right">RD$ {{ formatMoney totales.total }}</td></tr><tr><td>Depreciación Acumulada:</td><td style="text-align:right">RD$ {{ formatMoney extra.depreciacion_acum }}</td></tr><tr><td>Valor Residual:</td><td style="text-align:right">RD$ {{ formatMoney extra.valor_residual }}</td></tr><tr><td>Vida Útil:</td><td style="text-align:right">{{ extra.vida_util }} meses</td></tr></table></div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'TextoLibre', props: {
      id: 'declaracion',
      html: '<div style="margin-top:12px;font-size:10px">Por la presente acta, el responsable abajo firmante recibe en custodia el activo descrito y se compromete a su uso correcto, mantenimiento y devolución en las mismas condiciones, salvo desgaste natural.</div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'Firmas', props: { id: 'fi', cantidad: 2, labels: 'Entregado por|Recibido por', lineWidth: 70 } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} }, zones: {},
}
