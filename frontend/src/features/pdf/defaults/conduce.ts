// Conduce A4 — bloque reutilizable DocumentoSimple (estilo fino CxP, sin barra).
// Columnas: codigo/descripcion/cantidad/precio/descuento/total (sin ITBIS ni NCF).
export const conduceDefault: any = {
  content: [
    { type: 'WatermarkAnulada', props: { id: 'watermark', texto: 'ANULADA', opacity: 0.18, angle: -30, color: '#dc2626' } },
    { type: 'DocumentoSimple', props: {
      id: 'doc',
      columnas: 'codigo,descripcion,cantidad,precio,descuento,total',
      firmaIzq: 'Recibido por', firmaDer: 'Entregado por',
      mostrarAlmacen: false, montoLetras: true, introHtml: '', pieHtml: '',
    } },
    { type: 'FooterEmpresa', props: {
      id: 'fo',
      texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} },
  zones: {},
}
