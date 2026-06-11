import { facturaDefault } from './defaults/factura'
import { conduceDefault } from './defaults/conduce'
import { cotizacionDefault } from './defaults/cotizacion'
import { listadoFacturasDefault } from './defaults/listado-facturas'
import { facturaPosDefault } from './defaults/factura-pos'
import {
  ncfNulosDefault, facturasRncDefault, margenBrutoDefault, ncf607Default,
  listaPreciosDefault, cuadreCajaDefault, ventasProductosDefault, listadoConducesDefault,
  invDocumentoDefault, invExistenciaDefault, invMovimientosDefault,
  invKardexDefault, invValorizacionDefault, invCierreEntradaDefault,
} from './defaults/reporte-generico'

export type DocFamily = 'documento' | 'reporte'

export type RegistryEntry = {
  codigo: string
  modulo: 'FAT' | 'INV' | 'CXC' | 'CXP' | 'CNT' | 'BAN' | 'ODC' | 'CHC' | 'NOM' | 'ACF' | 'ACC' | 'SDN' | 'MAN'
  nombre: string
  familia: DocFamily
  printDataPath: (id: string, qs: URLSearchParams) => string
  defaultTemplate: any
  defaultPageSize?: 'A4' | 'LETTER' | 'POS80'
  defaultPageOrientation?: 'P' | 'L'
  variables: string[]
}

function splitTipo(id: string): { tipo: string; no: string } {
  const parts = (id || '').split('-')
  if (parts.length < 2) return { tipo: '', no: id }
  return { tipo: parts[0], no: parts.slice(1).join('-') }
}

const reporteVarsBase = [
  'cia.razon_social', 'cia.rnc', 'cia.direccion', 'cia.logo_url',
  'reporte.titulo', 'reporte.fecha_generacion', 'reporte.filtros',
  'totales.total', 'totales.cantidad',
]
const docVarsBase = [
  'cia.razon_social', 'cia.rnc', 'cia.direccion', 'cia.telefono', 'cia.email', 'cia.logo_url',
  'doc.tipo', 'doc.numero_display', 'doc.fecha', 'doc.ncf_dgi', 'doc.tipo_ncf_label',
  'doc.condicion_pago', 'doc.forma_pago', 'doc.vendedor', 'doc.nota',
  'cliente.nombre', 'cliente.rnc', 'cliente.direccion', 'cliente.telefono',
  'totales.subtotal', 'totales.descuento', 'totales.itbis', 'totales.propina',
  'totales.total', 'totales.monto_letras',
  'lineas[].codigo', 'lineas[].descripcion', 'lineas[].cantidad', 'lineas[].precio',
  'lineas[].descuento', 'lineas[].itbis', 'lineas[].total',
]

export const registry: Record<string, RegistryEntry> = {
  // ── FAT — documentos ───────────────────────────────────────────────
  factura: {
    codigo: 'factura', modulo: 'FAT', nombre: 'Factura A4', familia: 'documento',
    printDataPath: (id, qs) => `/fat/documentos/${encodeURIComponent(splitTipo(id).tipo)}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: facturaDefault,
    defaultPageSize: 'A4', defaultPageOrientation: 'P',
    variables: docVarsBase,
  },
  'factura-pos': {
    codigo: 'factura-pos', modulo: 'FAT', nombre: 'Factura POS 80mm', familia: 'documento',
    printDataPath: (id, qs) => `/fat/documentos/${encodeURIComponent(splitTipo(id).tipo)}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: facturaPosDefault,
    defaultPageSize: 'POS80', defaultPageOrientation: 'P',
    variables: docVarsBase,
  },
  conduce: {
    codigo: 'conduce', modulo: 'FAT', nombre: 'Conduce A4', familia: 'documento',
    printDataPath: (id, qs) => `/fat/conduces/${encodeURIComponent(splitTipo(id).tipo)}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: conduceDefault,
    defaultPageSize: 'A4', defaultPageOrientation: 'P',
    variables: docVarsBase,
  },
  cotizacion: {
    codigo: 'cotizacion', modulo: 'FAT', nombre: 'Cotización A4', familia: 'documento',
    printDataPath: (id, qs) => `/fat/conduces/${encodeURIComponent(splitTipo(id).tipo || 'CT')}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: cotizacionDefault,
    defaultPageSize: 'A4', defaultPageOrientation: 'P',
    variables: docVarsBase,
  },
  // ── FAT — reportes ─────────────────────────────────────────────────
  'listado-facturas': {
    codigo: 'listado-facturas', modulo: 'FAT', nombre: 'Listado de Facturas', familia: 'reporte',
    printDataPath: (_id, qs) => `/fat/reportes/listado/print-data/?${qs.toString()}`,
    defaultTemplate: listadoFacturasDefault,
    defaultPageSize: 'A4', defaultPageOrientation: 'P',
    variables: [...reporteVarsBase, 'filas[].no_factura', 'filas[].fecha', 'filas[].cliente', 'filas[].ncf_dgi', 'filas[].total'],
  },
  'listado-conduces': {
    codigo: 'listado-conduces', modulo: 'FAT', nombre: 'Listado de Conduces', familia: 'reporte',
    printDataPath: (_id, qs) => `/fat/reportes/listado-conduces/print-data/?${qs.toString()}`,
    defaultTemplate: listadoConducesDefault,
    defaultPageSize: 'A4', defaultPageOrientation: 'P',
    variables: [...reporteVarsBase, 'filas[].no_conduce', 'filas[].fecha', 'filas[].cliente', 'filas[].factura', 'filas[].total'],
  },
  'ncf-nulos': {
    codigo: 'ncf-nulos', modulo: 'FAT', nombre: 'NCF Nulos', familia: 'reporte',
    printDataPath: (_id, qs) => `/fat/reportes/ncf-nulos/print-data/?${qs.toString()}`,
    defaultTemplate: ncfNulosDefault,
    defaultPageSize: 'A4', defaultPageOrientation: 'P',
    variables: [...reporteVarsBase, 'filas[].ncf_dgi', 'filas[].fecha', 'filas[].motivo'],
  },
  'facturas-rnc': {
    codigo: 'facturas-rnc', modulo: 'FAT', nombre: 'Facturas con RNC', familia: 'reporte',
    printDataPath: (_id, qs) => `/fat/reportes/facturas-rnc/print-data/?${qs.toString()}`,
    defaultTemplate: facturasRncDefault,
    defaultPageSize: 'A4', defaultPageOrientation: 'P',
    variables: [...reporteVarsBase, 'filas[].no_factura', 'filas[].rnc', 'filas[].total_neto'],
  },
  'margen-bruto': {
    codigo: 'margen-bruto', modulo: 'FAT', nombre: 'Margen Bruto', familia: 'reporte',
    printDataPath: (_id, qs) => `/fat/reportes/margen-bruto/print-data/?${qs.toString()}`,
    defaultTemplate: margenBrutoDefault,
    defaultPageSize: 'A4', defaultPageOrientation: 'L',
    variables: [...reporteVarsBase, 'filas[].no_produ', 'filas[].venta', 'filas[].costo', 'filas[].beneficio'],
  },
  'ncf-607': {
    codigo: 'ncf-607', modulo: 'FAT', nombre: 'Reporte 607 NCF', familia: 'reporte',
    printDataPath: (_id, qs) => `/fat/reportes/607/print-data/?${qs.toString()}`,
    defaultTemplate: ncf607Default,
    defaultPageSize: 'A4', defaultPageOrientation: 'P',
    variables: [...reporteVarsBase, 'filas[].ncf', 'filas[].rnc', 'filas[].monto', 'filas[].itbis'],
  },
  'lista-precios': {
    codigo: 'lista-precios', modulo: 'FAT', nombre: 'Lista de Precios', familia: 'reporte',
    printDataPath: (_id, qs) => `/fat/reportes/lista-precios/print-data/?${qs.toString()}`,
    defaultTemplate: listaPreciosDefault,
    defaultPageSize: 'A4', defaultPageOrientation: 'P',
    variables: [...reporteVarsBase, 'filas[].no_produ', 'filas[].descripcion', 'filas[].precio'],
  },
  'cuadre-caja': {
    codigo: 'cuadre-caja', modulo: 'FAT', nombre: 'Cuadre de Caja', familia: 'reporte',
    printDataPath: (_id, qs) => `/fat/reportes/cuadre-caja/print-data/?${qs.toString()}`,
    defaultTemplate: cuadreCajaDefault,
    defaultPageSize: 'A4', defaultPageOrientation: 'P',
    variables: [...reporteVarsBase, 'filas[].no_factura', 'filas[].forma_pago', 'filas[].total'],
  },
  'ventas-productos': {
    codigo: 'ventas-productos', modulo: 'FAT', nombre: 'Ventas por Producto', familia: 'reporte',
    printDataPath: (_id, qs) => `/fat/reportes/ventas-productos/print-data/?${qs.toString()}`,
    defaultTemplate: ventasProductosDefault,
    defaultPageSize: 'A4', defaultPageOrientation: 'P',
    variables: [...reporteVarsBase, 'filas[].no_produ', 'filas[].cantidad', 'filas[].total_neto'],
  },
  // ── INV ────────────────────────────────────────────────────────────
  'inv-documento': {
    codigo: 'inv-documento', modulo: 'INV', nombre: 'Documento INV (entrada/salida/ajuste)', familia: 'documento',
    printDataPath: (id, qs) => `/inv/documentos/${encodeURIComponent(splitTipo(id).tipo)}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: invDocumentoDefault,
    defaultPageSize: 'A4', defaultPageOrientation: 'P',
    variables: docVarsBase.concat([
      'doc.tipo_movi', 'doc.tipo_transaccion', 'doc.almacen_origen', 'doc.almacen_destino',
      'proveedor.nombre', 'proveedor.rnc',
    ]),
  },
  'inv-existencia': {
    codigo: 'inv-existencia', modulo: 'INV', nombre: 'Existencia INV', familia: 'reporte',
    printDataPath: (_id, qs) => `/inv/reportes/existencia/print-data/?${qs.toString()}`,
    defaultTemplate: invExistenciaDefault,
    defaultPageSize: 'A4', defaultPageOrientation: 'L',
    variables: [...reporteVarsBase, 'filas[].almacen', 'filas[].no_produ', 'filas[].existencia', 'filas[].valor'],
  },
  'inv-movimientos': {
    codigo: 'inv-movimientos', modulo: 'INV', nombre: 'Movimientos INV', familia: 'reporte',
    printDataPath: (_id, qs) => `/inv/reportes/movimientos/print-data/?${qs.toString()}`,
    defaultTemplate: invMovimientosDefault,
    defaultPageSize: 'A4', defaultPageOrientation: 'L',
    variables: [...reporteVarsBase, 'filas[].fecha', 'filas[].tipo_docu', 'filas[].cantidad'],
  },
  'inv-kardex': {
    codigo: 'inv-kardex', modulo: 'INV', nombre: 'Kardex Producto', familia: 'reporte',
    printDataPath: (_id, qs) => `/inv/reportes/kardex/print-data/?${qs.toString()}`,
    defaultTemplate: invKardexDefault,
    defaultPageSize: 'A4', defaultPageOrientation: 'P',
    variables: [...reporteVarsBase, 'filas[].fecha', 'filas[].entrada', 'filas[].salida', 'filas[].balance'],
  },
  'inv-valorizacion': {
    codigo: 'inv-valorizacion', modulo: 'INV', nombre: 'Valorización INV', familia: 'reporte',
    printDataPath: (_id, qs) => `/inv/reportes/valorizacion/print-data/?${qs.toString()}`,
    defaultTemplate: invValorizacionDefault,
    defaultPageSize: 'A4', defaultPageOrientation: 'L',
    variables: [...reporteVarsBase, 'filas[].almacen', 'filas[].existencia', 'filas[].valor'],
  },
  'inv-cierre-entrada': {
    codigo: 'inv-cierre-entrada', modulo: 'INV', nombre: 'Cierre Entrada Diario', familia: 'reporte',
    printDataPath: (_id, qs) => `/inv/cierre/entrada-diario/print-data/?${qs.toString()}`,
    defaultTemplate: invCierreEntradaDefault,
    defaultPageSize: 'A4', defaultPageOrientation: 'P',
    variables: [...reporteVarsBase, 'filas[].tipo_docu', 'filas[].no_docu', 'filas[].total'],
  },
}

export function getRegistryEntry(codigo: string): RegistryEntry | undefined {
  return registry[codigo]
}

export function listRegistry(): RegistryEntry[] {
  return Object.values(registry)
}

// Códigos planificados (sin print-data aún — para mostrar en el listado como "Próximamente").
export const PLANIFICADOS: Array<{ codigo: string; modulo: string; nombre: string }> = [
  // FAT pendientes (Fase 1 extra)
  { codigo: 'nota-credito', modulo: 'FAT', nombre: 'Nota de Crédito' },
  { codigo: 'nota-debito', modulo: 'FAT', nombre: 'Nota de Débito' },
  { codigo: 'devolucion', modulo: 'FAT', nombre: 'Devolución' },
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
  // BAN, ODC, CHC, NOM, ACF, ACC, SDN, MAN
  { codigo: 'cheque-impreso', modulo: 'BAN', nombre: 'Cheque Impreso' },
  { codigo: 'orden-compra', modulo: 'ODC', nombre: 'Orden de Compra' },
  { codigo: 'cheque-caja-chica', modulo: 'CHC', nombre: 'Cheque Caja Chica' },
  { codigo: 'volante-pago', modulo: 'NOM', nombre: 'Volante de Pago' },
  { codigo: 'acta-activo', modulo: 'ACF', nombre: 'Acta de Activo' },
  { codigo: 'acc-documento', modulo: 'ACC', nombre: 'Documento ACC' },
  { codigo: 'sdn-documento', modulo: 'SDN', nombre: 'Documento SDN' },
  { codigo: 'man-orden-trabajo', modulo: 'MAN', nombre: 'Orden de Trabajo MAN' },
]
