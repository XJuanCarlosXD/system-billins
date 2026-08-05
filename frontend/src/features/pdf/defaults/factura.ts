// Plantilla default para Factura A4 — usa el bloque reutilizable DocumentoSimple
// (estilo fino CxP: encabezado en negrita con raya, SIN barra oscura ni zebra).
// Columnas de factura: codigo/descripcion/cantidad/precio/descuento/itbis/total,
// con monto en letras. Sin HTML suelto: la lógica vive en el componente.
export const facturaDefault: any = {
  content: [
    { type: 'WatermarkAnulada', props: { id: 'watermark-1', texto: 'ANULADA', opacity: 0.18, angle: -30, color: '#dc2626' } },
    { type: 'DocumentoSimple', props: {
      id: 'doc',
      columnas: 'codigo,descripcion,cantidad,precio,descuento,itbis,total',
      firmaIzq: 'Recibido por', firmaDer: 'Entregado por',
      mostrarAlmacen: false, montoLetras: true, introHtml: '', pieHtml: '',
    } },
    { type: 'FooterEmpresa', props: {
      id: 'footer',
      texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }} | Tel: {{ cia.telefono }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} },
  zones: {},
}
