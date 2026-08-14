// Plantilla ODC — Orden de Compra
// Estilo "sencillo" (DocumentoSimple) — mismo layout fino usado en
// FAT/INV/CxP: sin barra oscura, sin zebra, mismo tamaño de letra.
export const ordenCompraDefault: any = {
  content: [
    { type: 'WatermarkAnulada', props: { id: 'wm', texto: 'ANULADA', opacity: 0.18, angle: -30, color: '#dc2626' } },
    {
      type: 'DocumentoSimple',
      props: {
        id: 'doc',
        columnas: 'codigo,descripcion,cantidad,unidad,precio,descuento,itbis,total',
        firmaIzq: 'Solicitado por',
        firmaDer: 'Autorizado por',
        mostrarAlmacen: false,
        montoLetras: false,
        introHtml:
          '<div style="margin:2px 0 8px;font-size:9px">{{#if doc.fecha_venc}}<b>Fecha entrega solicitada:</b> {{formatDate doc.fecha_venc}}{{/if}}{{#if doc.estado_label}} &nbsp;&nbsp; <b>Estado:</b> {{doc.estado_label}}{{/if}}</div>',
        pieHtml:
          '<div style="margin-top:8px;font-size:9px;color:#475569"><b>Condiciones:</b> Los precios incluyen ITBIS. El proveedor debe entregar copia firmada de esta orden con la mercancía. Cualquier diferencia debe reportarse en 48 horas.</div>',
      },
    },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }} | Tel: {{ cia.telefono }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} }, zones: {},
}
