import type { Data } from '@measured/puck'
import type { PuckBlockProps } from './blocks'
import { facturaDefault } from './defaults/factura'
import { conduceDefault } from './defaults/conduce'
import { cotizacionDefault } from './defaults/cotizacion'
import { listadoFacturasDefault } from './defaults/listado-facturas'

export type DocFamily = 'documento' | 'reporte'

export type RegistryEntry = {
  codigo: string
  modulo: 'FAT' | 'INV' | 'CXC' | 'CXP' | 'CNT' | 'BAN' | 'ODC' | 'CHC' | 'NOM' | 'ACF' | 'ACC' | 'SDN' | 'MAN'
  nombre: string
  familia: DocFamily
  printDataPath: (id: string, qs: URLSearchParams) => string
  defaultTemplate: Data<PuckBlockProps>
  defaultPageSize?: 'A4' | 'LETTER' | 'POS80'
  defaultPageOrientation?: 'P' | 'L'
  /** Variables disponibles para el árbol del editor — keys = paths dot-notation. */
  variables: string[]
}

// Default template para reporte vacío (placeholder usado por codigos sin default real aún).
const reporteEmpty: Data<PuckBlockProps> = listadoFacturasDefault

export const registry: Record<string, RegistryEntry> = {
  // ── FAT ─────────────────────────────────────────────────────────────────
  factura: {
    codigo: 'factura',
    modulo: 'FAT',
    nombre: 'Factura A4',
    familia: 'documento',
    printDataPath: (id, qs) => `/fat/documentos/${encodeURIComponent(splitTipo(id).tipo)}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: facturaDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: [
      'cia.razon_social', 'cia.rnc', 'cia.direccion', 'cia.telefono', 'cia.email', 'cia.logo_url',
      'doc.tipo', 'doc.numero_display', 'doc.fecha', 'doc.ncf_dgi', 'doc.tipo_ncf_label',
      'doc.condicion_pago', 'doc.forma_pago', 'doc.vendedor', 'doc.nota',
      'cliente.nombre', 'cliente.rnc', 'cliente.direccion', 'cliente.telefono',
      'totales.subtotal', 'totales.descuento', 'totales.itbis', 'totales.propina',
      'totales.total', 'totales.monto_letras',
      'lineas[].codigo', 'lineas[].descripcion', 'lineas[].cantidad', 'lineas[].precio',
      'lineas[].descuento', 'lineas[].itbis', 'lineas[].total',
    ],
  },
  conduce: {
    codigo: 'conduce',
    modulo: 'FAT',
    nombre: 'Conduce / Cotización A4',
    familia: 'documento',
    printDataPath: (id, qs) => `/fat/conduces/${encodeURIComponent(splitTipo(id).tipo)}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: conduceDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: [
      'cia.razon_social', 'cia.rnc', 'cia.direccion',
      'doc.tipo', 'doc.numero_display', 'doc.fecha', 'doc.vendedor', 'doc.factura_relacionada',
      'cliente.nombre', 'cliente.rnc', 'cliente.direccion',
      'totales.subtotal', 'totales.itbis', 'totales.total',
      'lineas[].codigo', 'lineas[].descripcion', 'lineas[].cantidad', 'lineas[].precio', 'lineas[].total',
    ],
  },
  cotizacion: {
    codigo: 'cotizacion',
    modulo: 'FAT',
    nombre: 'Cotización A4 (formato comercial)',
    familia: 'documento',
    printDataPath: (id, qs) => `/fat/conduces/${encodeURIComponent(splitTipo(id).tipo || 'CT')}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: cotizacionDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: [
      'cia.razon_social', 'cia.rnc', 'cia.email', 'cia.telefono',
      'doc.numero_display', 'doc.fecha', 'doc.fecha_venc', 'doc.condicion_pago', 'doc.vendedor',
      'cliente.nombre', 'cliente.rnc', 'cliente.direccion', 'cliente.telefono', 'cliente.email',
      'totales.subtotal', 'totales.itbis', 'totales.total',
      'lineas[].codigo', 'lineas[].descripcion', 'lineas[].cantidad', 'lineas[].precio', 'lineas[].total',
    ],
  },
  'listado-facturas': {
    codigo: 'listado-facturas',
    modulo: 'FAT',
    nombre: 'Listado de Facturas',
    familia: 'reporte',
    printDataPath: (_id, qs) => `/fat/reportes/listado/print-data/?${qs.toString()}`,
    defaultTemplate: listadoFacturasDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: [
      'cia.razon_social', 'cia.rnc',
      'reporte.titulo', 'reporte.fecha_generacion', 'reporte.filtros',
      'filas[].no_factura', 'filas[].fecha', 'filas[].cliente', 'filas[].ncf_dgi', 'filas[].estado', 'filas[].total',
      'totales.total', 'totales.cantidad',
    ],
  },
  // ── Reservados (sin print-data implementado aún — la skill PDFs documenta el patrón) ──
  // Se rellenan en fases siguientes.
}

function splitTipo(id: string): { tipo: string; no: string } {
  const parts = (id || '').split('-')
  if (parts.length < 2) return { tipo: '', no: id }
  return { tipo: parts[0], no: parts.slice(1).join('-') }
}

export function getRegistryEntry(codigo: string): RegistryEntry | undefined {
  return registry[codigo]
}

export function listRegistry(): RegistryEntry[] {
  return Object.values(registry)
}

// Códigos planificados (de la sección 2.D del spec). Se muestran en el listado
// del editor incluso si aún no tienen defaultTemplate, marcados como "próximamente".
export const PLANIFICADOS: Array<{ codigo: string; modulo: string; nombre: string }> = [
  // FAT
  { codigo: 'factura-pos', modulo: 'FAT', nombre: 'Factura POS 80mm' },
  { codigo: 'nota-credito', modulo: 'FAT', nombre: 'Nota de Crédito' },
  { codigo: 'nota-debito', modulo: 'FAT', nombre: 'Nota de Débito' },
  { codigo: 'devolucion', modulo: 'FAT', nombre: 'Devolución' },
  { codigo: 'listado-conduces', modulo: 'FAT', nombre: 'Listado de Conduces' },
  { codigo: 'ncf-nulos', modulo: 'FAT', nombre: 'NCF Nulos' },
  { codigo: 'facturas-rnc', modulo: 'FAT', nombre: 'Facturas con RNC' },
  { codigo: 'margen-bruto', modulo: 'FAT', nombre: 'Margen Bruto' },
  { codigo: 'ncf-607', modulo: 'FAT', nombre: 'Reporte 607 NCF' },
  { codigo: 'lista-precios', modulo: 'FAT', nombre: 'Lista de Precios' },
  { codigo: 'cuadre-caja', modulo: 'FAT', nombre: 'Cuadre de Caja' },
  { codigo: 'ventas-productos', modulo: 'FAT', nombre: 'Ventas por Producto' },
  // INV
  { codigo: 'inv-documento', modulo: 'INV', nombre: 'Documento INV (entrada/salida/ajuste)' },
  { codigo: 'inv-existencia', modulo: 'INV', nombre: 'Existencia' },
  { codigo: 'inv-movimientos', modulo: 'INV', nombre: 'Movimientos' },
  { codigo: 'inv-kardex', modulo: 'INV', nombre: 'Kardex' },
  { codigo: 'inv-valorizacion', modulo: 'INV', nombre: 'Valorización' },
  { codigo: 'inv-cierre-entrada', modulo: 'INV', nombre: 'Cierre Entrada Diario' },
  // CXC
  { codigo: 'recibo-cobro', modulo: 'CXC', nombre: 'Recibo de Cobro' },
  { codigo: 'estado-cuenta-cliente', modulo: 'CXC', nombre: 'Estado de Cuenta Cliente' },
  { codigo: 'aging-cxc', modulo: 'CXC', nombre: 'Aging CxC' },
  // CXP
  { codigo: 'comprobante-pago', modulo: 'CXP', nombre: 'Comprobante de Pago' },
  { codigo: 'estado-cuenta-proveedor', modulo: 'CXP', nombre: 'Estado de Cuenta Proveedor' },
  { codigo: 'aging-cxp', modulo: 'CXP', nombre: 'Aging CxP' },
  // CNT
  { codigo: 'comprobante-contable', modulo: 'CNT', nombre: 'Comprobante Contable' },
  { codigo: 'libro-diario', modulo: 'CNT', nombre: 'Libro Diario' },
  { codigo: 'libro-mayor', modulo: 'CNT', nombre: 'Libro Mayor' },
  { codigo: 'balance-comprobacion', modulo: 'CNT', nombre: 'Balance de Comprobación' },
  { codigo: 'balance-general', modulo: 'CNT', nombre: 'Balance General' },
  { codigo: 'estado-resultados', modulo: 'CNT', nombre: 'Estado de Resultados' },
  // BAN
  { codigo: 'cheque-impreso', modulo: 'BAN', nombre: 'Cheque Impreso' },
  { codigo: 'conciliacion-bancaria', modulo: 'BAN', nombre: 'Conciliación Bancaria' },
  // ODC
  { codigo: 'orden-compra', modulo: 'ODC', nombre: 'Orden de Compra' },
  // CHC
  { codigo: 'cheque-caja-chica', modulo: 'CHC', nombre: 'Cheque Caja Chica' },
  // NOM
  { codigo: 'volante-pago', modulo: 'NOM', nombre: 'Volante de Pago' },
  { codigo: 'recibo-nomina', modulo: 'NOM', nombre: 'Recibo de Nómina' },
  // ACF
  { codigo: 'acta-activo', modulo: 'ACF', nombre: 'Acta de Activo' },
  // ACC / SDN / MAN
  { codigo: 'acc-documento', modulo: 'ACC', nombre: 'Documento ACC' },
  { codigo: 'sdn-documento', modulo: 'SDN', nombre: 'Documento SDN' },
  { codigo: 'man-orden-trabajo', modulo: 'MAN', nombre: 'Orden de Trabajo MAN' },
]

void reporteEmpty
