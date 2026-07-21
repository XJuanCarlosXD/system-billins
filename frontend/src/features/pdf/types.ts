// Tipos compartidos del sistema de PDFs en frontend.
// Ver spec: backend/docs/superpowers/specs/2026-06-10-pdf-frontend-templates-design.md

export type CiaPayload = {
  no_cia: string
  razon_social: string
  rnc: string
  direccion: string
  telefono: string
  email: string
  logo_url: string
  color_primario: string
}

export type ClientePayload = {
  no?: number | string
  nombre: string
  rnc: string
  direccion: string
  telefono: string
  email: string
  tipo_ncf: string
}

export type LineaPayload = {
  no_linea?: number
  codigo: string
  descripcion: string
  almacen?: string
  cantidad: number
  unidad?: string
  precio: number
  porc_descuento?: number
  descuento?: number
  porciento_impuesto?: number
  itbis?: number
  total: number
  cantidad_regalia?: number
  anulada?: boolean
  /** Cantidad de este producto devuelta via DV contra esta misma factura. */
  devuelto_cantidad?: number
  /** Total de la linea despues de restar la porcion devuelta. */
  monto_actualizado?: number
}

export type DocumentoAplicadoPayload = {
  tipo_docu: string
  no_docu: string
  numero_display: string
  monto: number
  fecha: string
}

export type TotalesPayload = {
  subtotal?: number
  descuento?: number
  itbis?: number
  propina?: number
  otros?: number
  total: number
  monto_letras?: string
  cantidad?: number
}

export type DocPayload = {
  tipo: string
  tipo_label?: string
  no: string | number
  numero_display?: string
  fecha?: string | null
  fecha_venc?: string | null
  ncf?: number | null
  ncf_dgi?: string
  tipo_ncf?: string
  tipo_ncf_label?: string
  estado?: string
  anulada?: boolean
  impresion?: string
  condicion_pago?: string
  forma_pago?: string
  plazo_pago?: number
  vendedor?: string
  vendedor_codigo?: string
  vendedor_nombre?: string
  nota?: string
  detalle?: string
  moneda?: string
  tasa?: number
  porc_impuesto?: number
  factura_relacionada?: string
}

export type ReportePayload = {
  codigo: string
  titulo: string
  fecha_generacion?: string | null
  filtros?: Record<string, string | number>
}

export type DocumentoPrintPayload = {
  cia: CiaPayload
  doc: DocPayload
  cliente?: ClientePayload
  proveedor?: ClientePayload
  lineas: LineaPayload[]
  totales: TotalesPayload
  extra?: Record<string, unknown>
}

export type ReportePrintPayload = {
  cia: CiaPayload
  reporte: ReportePayload
  filas: Array<Record<string, unknown>>
  totales?: TotalesPayload
  extra?: Record<string, unknown>
}

export type PrintPayload = DocumentoPrintPayload | ReportePrintPayload

export function isReportePayload(p: PrintPayload): p is ReportePrintPayload {
  return (p as ReportePrintPayload).reporte !== undefined
}

// Plantilla guardada en TFAT_PLANTILLA_PDF
export type Plantilla = {
  no_cia: string
  codigo_doc: string
  nombre: string
  definicion_json: string | null
  page_size: 'A4' | 'LETTER' | 'POS80'
  page_orientation: 'P' | 'L'
  activo: boolean
  version: number
  fecha_mod: string | null
  usuario_mod: string
  personalizada: boolean
}
