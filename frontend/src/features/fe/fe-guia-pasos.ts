export interface GuiaPaso {
  selector: string
  titulo: string
  descripcion: string
  posicion: 'top' | 'bottom' | 'left' | 'right'
}

export const GUIA_FAT_NUEVA_FACTURA: GuiaPaso[] = [
  {
    selector: '[data-tour="tipo-documento"]',
    titulo: 'Tipo de documento',
    descripcion:
      'Selecciona el tipo de factura. Con e-CF activo, el sistema determina automáticamente si es tipo 31 (Crédito Fiscal) o 32 (Consumo) según el cliente.',
    posicion: 'bottom',
  },
  {
    selector: '[data-tour="cliente"]',
    titulo: 'Cliente',
    descripcion:
      'Busca y selecciona el cliente. Si tiene RNC, se emite Crédito Fiscal (e-CF 31). Sin RNC, se emite Consumo (e-CF 32). Verifica que el RNC esté correcto — la DGII rechaza RNC inválidos.',
    posicion: 'bottom',
  },
  {
    selector: '[data-tour="comprobante"]',
    titulo: 'Comprobante electrónico',
    descripcion:
      'Aquí aparece el e-NCF que se asignará (ej. E310000000141). Con e-CF activo, el sistema usa secuencias electrónicas aprobadas por la DGII — NO el NCF de papel.',
    posicion: 'bottom',
  },
  {
    selector: '[data-tour="guardar"]',
    titulo: 'Guardar = enviar a DGII',
    descripcion:
      'Al guardar la factura, el e-CF se genera, firma y envía automáticamente a la DGII. Si es aceptado, queda registrado. Si es rechazado, recibirás un aviso con el motivo.',
    posicion: 'left',
  },
]

export const GUIA_CXP_ENTRADA: GuiaPaso[] = [
  {
    selector: '[data-tour="tipo-docu"]',
    titulo: 'Tipo de documento',
    descripcion:
      'FP (Factura Proveedor) genera e-CF tipo 41 (Compras). Si el gasto no tiene comprobante del proveedor, es tipo 43 (Gastos Menores, hasta RD$50,000).',
    posicion: 'bottom',
  },
  {
    selector: '[data-tour="ncf-proveedor"]',
    titulo: 'NCF del proveedor',
    descripcion:
      'Ingresa el NCF que te dio el proveedor. Este dato va en el e-CF — un NCF incorrecto causa rechazo de la DGII. Verifícalo antes de guardar.',
    posicion: 'bottom',
  },
  {
    selector: '[data-tour="guardar"]',
    titulo: 'Guardar = e-CF automático',
    descripcion:
      'Al guardar, se genera y envía el comprobante electrónico a la DGII automáticamente.',
    posicion: 'left',
  },
]

export const GUIA_CXC_ENTRADA: GuiaPaso[] = [
  {
    selector: '[data-tour="tipo-docu"]',
    titulo: 'Nota de Débito / Crédito',
    descripcion:
      'ND genera e-CF tipo 33, NC genera e-CF tipo 34. Ambas DEBEN referenciar la factura original — el sistema lo hace automáticamente.',
    posicion: 'bottom',
  },
  {
    selector: '[data-tour="factura-ref"]',
    titulo: 'Factura que modifica',
    descripcion:
      'La DGII exige que toda ND/NC electrónica indique el e-NCF de la factura original. Si la factura original no tiene e-NCF (fue antes de activar e-CF), la ND/NC se emite con NCF papel.',
    posicion: 'bottom',
  },
  {
    selector: '[data-tour="guardar"]',
    titulo: 'Guardar = e-CF automático',
    descripcion:
      'Al guardar, el e-CF se genera con la referencia a la factura original y se envía a la DGII.',
    posicion: 'left',
  },
]

export const GUIA_ACC_EGRESO: GuiaPaso[] = [
  {
    selector: '[data-tour="comprobante"]',
    titulo: 'Comprobante de gasto',
    descripcion:
      'Los egresos de caja chica con comprobante fiscal generan e-CF tipo 43 (Gastos Menores). Aplica para montos hasta RD$50,000.',
    posicion: 'bottom',
  },
  {
    selector: '[data-tour="guardar"]',
    titulo: 'Guardar = e-CF automático',
    descripcion:
      'Al guardar el egreso, se genera y envía el e-CF a la DGII.',
    posicion: 'left',
  },
]
