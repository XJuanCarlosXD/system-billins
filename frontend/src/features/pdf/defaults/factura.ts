import type { Data } from '@measured/puck'
import type { PuckBlockProps } from '../blocks'

export const facturaDefault: Data<PuckBlockProps> = {
  content: [
    { type: 'WatermarkAnulada', props: {
      id: 'watermark-1', texto: 'ANULADA', opacity: 0.18, angle: -30, color: '#dc2626',
    } as any },
    { type: 'HeaderEmpresa', props: {
      id: 'header-empresa', showLogo: true, logoAlign: 'left', colorPrimario: '#0F172A',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 16,
    } as any },
    { type: 'HeaderDocumento', props: {
      id: 'header-doc', showNcf: true, showFechaVenc: false, showImpresion: true,
      bgColor: '#0F172A', textColor: '#ffffff',
    } as any },
    { type: 'Spacer', props: { id: 'sp-1', height: 6 } as any },
    { type: 'BloqueCliente', props: {
      id: 'cliente', columnas: 2,
      showNombre: true, showRnc: true, showDireccion: true,
      showTelefono: false, showEmail: false, showTipoNcf: true, showCondicion: true, showVendedor: true,
    } as any },
    { type: 'Spacer', props: { id: 'sp-2', height: 6 } as any },
    { type: 'TablaLineas', props: {
      id: 'tabla',
      columnas: ['codigo', 'descripcion', 'cantidad', 'precio', 'descuento', 'itbis', 'total'],
      zebra: true, headerBg: '#0F172A', headerColor: '#ffffff', fontSize: 9,
    } as any },
    { type: 'BloqueTotales', props: {
      id: 'totales',
      showSubtotal: true, showDescuento: true, showItbis: true, showPropina: true,
      showOtros: false, showMontoLetras: true, align: 'right', colorTotal: '#0F172A',
    } as any },
    { type: 'NotaDetalle', props: { id: 'nota', titulo: 'Nota:', mostrarSiVacio: false } as any },
    { type: 'Firmas', props: {
      id: 'firmas', cantidad: 2, labels: 'Recibido por|Entregado por', lineWidth: 80,
    } as any },
    { type: 'FooterEmpresa', props: {
      id: 'footer',
      texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }} | Tel: {{ cia.telefono }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } as any },
  ],
  root: { props: {} },
  zones: {},
}
