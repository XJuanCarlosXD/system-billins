// Plantilla SDN — Cabecera de Nómina
// Resumen ejecutivo de una nómina (no es el volante por empleado, eso queda pendiente).
export const sdnNominaDefault: any = {
  content: [
    { type: 'EncabezadoFactura', props: {
      id: 'encab', showLogo: true, colorPrimario: '#0e7490',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 15,
      docBg: '#0e7490', docColor: '#ffffff', showNcf: false, showImpresion: true,
    } },
    { type: 'TextoLibre', props: {
      id: 'header',
      html: '<div style="margin-top:8px;padding:10px;background:#ecfeff;border-left:3px solid #0e7490"><b>Nómina:</b> {{ doc.numero_display }}<br/><b>Descripción:</b> {{ doc.detalle }}<br/><b>Período:</b> {{ default doc.periodo "—" }}<br/><b>Fecha inicial:</b> {{ formatDate doc.fecha }} &nbsp; <b>Fecha final:</b> {{ formatDate doc.fecha_venc }}<br/><b>Forma de pago:</b> {{ doc.forma_pago }} &nbsp; <b>Estado:</b> {{ doc.estado }}<br/><b>Cuenta contable:</b> {{ default extra.cuenta_contable "—" }} &nbsp; <b>Cuenta bancaria:</b> {{ default extra.cuenta_bancaria "—" }}</div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'TextoLibre', props: {
      id: 'nota',
      html: '<div style="margin-top:12px;font-size:9px;color:#475569"><i>Para el detalle individual de pagos por empleado, ver el volante de pago correspondiente.</i></div>',
      fontSize: 9, textAlign: 'left',
    } },
    { type: 'Firmas', props: { id: 'fi', cantidad: 2, labels: 'Preparado por|Autorizado por', lineWidth: 70 } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} }, zones: {},
}
