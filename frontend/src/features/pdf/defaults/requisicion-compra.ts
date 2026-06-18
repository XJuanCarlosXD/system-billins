// Plantilla ODC — Requisición Interna
// Sin precios: cantidades pedidas, autorizadas y pendientes + notas.
export const requisicionCompraDefault: any = {
  content: [
    { type: 'WatermarkAnulada', props: { id: 'wm', texto: 'ANULADA', opacity: 0.18, angle: -30, color: '#dc2626' } },
    { type: 'EncabezadoFactura', props: {
      id: 'encab', showLogo: true, colorPrimario: '#0f766e',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 15,
      docBg: '#0f766e', docColor: '#ffffff', showNcf: false, showImpresion: true,
    } },
    { type: 'TextoLibre', props: {
      id: 'intro',
      html: '<div style="margin-top:8px;padding:8px;background:#ecfdf5;border-left:3px solid #0f766e"><b>Solicitante:</b> {{ default cliente.nombre "—" }}<br/><b>Localidad:</b> {{ default doc.no_localidad "—" }} &nbsp; <b>Depto:</b> {{ default doc.no_depto "—" }}<br/><b>Fecha solicitud:</b> {{ formatDate doc.fecha }} &nbsp;&nbsp; <b>Fecha requerida:</b> {{ formatDate doc.fecha_venc }}<br/><b>Estado:</b> {{ default doc.estado_label doc.estado }}</div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'Spacer', props: { id: 'sp1', height: 6 } },
    { type: 'TablaLineas', props: {
      id: 'tabla',
      columnas: ['codigo', 'descripcion', 'cantidad', 'unidad'],
      zebra: true, headerBg: '#0f766e', headerColor: '#ffffff', fontSize: 9,
    } },
    { type: 'NotaDetalle', props: { id: 'observ', titulo: 'Justificación / observaciones:', mostrarSiVacio: false } },
    { type: 'Spacer', props: { id: 'sp2', height: 6 } },
    { type: 'TextoLibre', props: {
      id: 'notas',
      html: '<div style="font-size:9px;color:#475569"><b>Notas:</b> Esta requisición debe ser autorizada (hasta 3 firmas) antes de convertirse en orden de compra. La aprobación queda registrada en TODC_REQUISICION.</div>',
      fontSize: 9, textAlign: 'left',
    } },
    { type: 'Firmas', props: { id: 'fi', cantidad: 3, labels: 'Solicitado por|Autorizado 1|Autorizado 2', lineWidth: 60 } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }} | Tel: {{ cia.telefono }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} }, zones: {},
}
