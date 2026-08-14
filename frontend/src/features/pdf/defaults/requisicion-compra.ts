// Plantilla ODC — Requisición Interna
// Estilo "sencillo" (DocumentoSimple) — mismo layout fino usado en
// FAT/INV/CxP: sin barra oscura, sin zebra, mismo tamaño de letra.
// Sin precios: solo cantidades pedidas + notas.
export const requisicionCompraDefault: any = {
  content: [
    { type: 'WatermarkAnulada', props: { id: 'wm', texto: 'ANULADA', opacity: 0.18, angle: -30, color: '#dc2626' } },
    {
      type: 'DocumentoSimple',
      props: {
        id: 'doc',
        columnas: 'codigo,descripcion,cantidad,unidad',
        firmaIzq: 'Solicitado por',
        firmaDer: 'Autorizado por',
        mostrarAlmacen: false,
        montoLetras: false,
        introHtml:
          '<div style="margin:2px 0 8px;font-size:9px">{{#if doc.no_localidad}}<b>Localidad:</b> {{doc.no_localidad}}{{/if}}{{#if doc.no_depto}} &nbsp;&nbsp; <b>Depto:</b> {{doc.no_depto}}{{/if}}{{#if doc.fecha_venc}} &nbsp;&nbsp; <b>Fecha requerida:</b> {{formatDate doc.fecha_venc}}{{/if}}{{#if doc.estado_label}} &nbsp;&nbsp; <b>Estado:</b> {{doc.estado_label}}{{/if}}</div>',
        pieHtml:
          '<div style="margin-top:8px;font-size:9px;color:#475569"><b>Notas:</b> Esta requisición debe ser autorizada antes de convertirse en orden de compra. La aprobación queda registrada en TODC_REQUISICION.</div>',
      },
    },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }} | Tel: {{ cia.telefono }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} }, zones: {},
}
