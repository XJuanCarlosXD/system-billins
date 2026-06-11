import type { Data } from '@measured/puck'
import type { PuckBlockProps } from '../blocks'

export const conduceDefault: Data<PuckBlockProps> = {
  content: [
    { type: 'WatermarkAnulada', props: {
      id: 'watermark', texto: 'ANULADA', opacity: 0.18, angle: -30, color: '#dc2626',
    } as any },
    { type: 'HeaderEmpresa', props: {
      id: 'he', showLogo: true, logoAlign: 'left', colorPrimario: '#0F172A',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 16,
    } as any },
    { type: 'HeaderDocumento', props: {
      id: 'hd', showNcf: false, showFechaVenc: false, showImpresion: true,
      bgColor: '#475569', textColor: '#ffffff',
    } as any },
    { type: 'Spacer', props: { id: 'sp1', height: 6 } as any },
    { type: 'BloqueCliente', props: {
      id: 'cl', columnas: 2,
      showNombre: true, showRnc: true, showDireccion: true,
      showTelefono: false, showEmail: false, showTipoNcf: false, showCondicion: true, showVendedor: true,
    } as any },
    { type: 'Spacer', props: { id: 'sp2', height: 6 } as any },
    { type: 'TablaLineas', props: {
      id: 'tabla',
      columnas: ['codigo', 'descripcion', 'cantidad', 'precio', 'descuento', 'total'],
      zebra: true, headerBg: '#475569', headerColor: '#ffffff', fontSize: 9,
    } as any },
    { type: 'BloqueTotales', props: {
      id: 'tot',
      showSubtotal: true, showDescuento: true, showItbis: true, showPropina: false,
      showOtros: false, showMontoLetras: true, align: 'right', colorTotal: '#475569',
    } as any },
    { type: 'NotaDetalle', props: { id: 'nota', titulo: 'Detalle:', mostrarSiVacio: false } as any },
    { type: 'Firmas', props: {
      id: 'fi', cantidad: 2, labels: 'Recibido por|Entregado por', lineWidth: 80,
    } as any },
    { type: 'FooterEmpresa', props: {
      id: 'fo',
      texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } as any },
  ],
  root: { props: {} },
  zones: {},
}
