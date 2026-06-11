// Registry SOLO de DOCUMENTOS (no reportes).
// Los reportes (NCF nulos, listado facturas, kardex, balance, etc.) siguen
// generándose con los endpoints `*_pdf` ReportLab del backend — el usuario
// no quiere editarlos visualmente, así que no aparecen en /settings/pdf-templates.

import { facturaDefault } from './defaults/factura'
import { conduceDefault } from './defaults/conduce'
import { cotizacionDefault } from './defaults/cotizacion'
import { facturaPosDefault } from './defaults/factura-pos'
import { invDocumentoDefault } from './defaults/reporte-generico'
import { reciboCobroDefault } from './defaults/recibo-cobro'
import { comprobantePagoDefault } from './defaults/comprobante-pago'
import { ordenCompraDefault } from './defaults/orden-compra'
import { chequeChcDefault } from './defaults/cheque-chc'
import { accDocumentoDefault } from './defaults/acc-documento'

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

const docVarsBase = [
  'cia.razon_social', 'cia.rnc', 'cia.direccion', 'cia.telefono', 'cia.email', 'cia.logo_url',
  'doc.tipo', 'doc.numero_display', 'doc.fecha', 'doc.ncf_dgi', 'doc.tipo_ncf_label',
  'doc.condicion_pago', 'doc.forma_pago', 'doc.vendedor', 'doc.nota', 'doc.anulada',
  'cliente.nombre', 'cliente.rnc', 'cliente.direccion', 'cliente.telefono',
  'totales.subtotal', 'totales.descuento', 'totales.itbis', 'totales.propina',
  'totales.total', 'totales.monto_letras',
  'lineas[].codigo', 'lineas[].descripcion', 'lineas[].cantidad', 'lineas[].precio',
  'lineas[].descuento', 'lineas[].itbis', 'lineas[].total',
]

export const registry: Record<string, RegistryEntry> = {
  // ── FAT — documentos transaccionales ───────────────────────────────
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
  // ── INV — documento (entrada/salida/ajuste/traspaso) ───────────────
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
  // ── CXC ────────────────────────────────────────────────────────────
  'recibo-cobro': {
    codigo: 'recibo-cobro', modulo: 'CXC', nombre: 'Recibo de Cobro', familia: 'documento',
    printDataPath: (id, qs) => `/cxc/documentos/${encodeURIComponent(id)}/print-data/?${qs.toString()}`,
    defaultTemplate: reciboCobroDefault,
    defaultPageSize: 'A4', defaultPageOrientation: 'P',
    variables: docVarsBase.concat(['extra.saldo']),
  },
  // ── CXP ────────────────────────────────────────────────────────────
  'comprobante-pago': {
    codigo: 'comprobante-pago', modulo: 'CXP', nombre: 'Comprobante de Pago', familia: 'documento',
    printDataPath: (id, qs) => `/cxp/documentos/${encodeURIComponent(splitTipo(id).tipo)}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: comprobantePagoDefault,
    defaultPageSize: 'A4', defaultPageOrientation: 'P',
    variables: docVarsBase.concat(['proveedor.nombre', 'proveedor.rnc', 'extra.saldo']),
  },
  // ── ODC ────────────────────────────────────────────────────────────
  'orden-compra': {
    codigo: 'orden-compra', modulo: 'ODC', nombre: 'Orden de Compra', familia: 'documento',
    printDataPath: (id, qs) => `/odc/ordenes/${encodeURIComponent(id)}/print-data/?${qs.toString()}`,
    defaultTemplate: ordenCompraDefault,
    defaultPageSize: 'A4', defaultPageOrientation: 'P',
    variables: docVarsBase.concat(['proveedor.nombre', 'proveedor.rnc']),
  },
  // ── CHC ────────────────────────────────────────────────────────────
  'cheque-caja-chica': {
    codigo: 'cheque-caja-chica', modulo: 'CHC', nombre: 'Cheque / Comprobante CHC', familia: 'documento',
    printDataPath: (id, qs) => `/chc/cheques/${encodeURIComponent(splitTipo(id).tipo)}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: chequeChcDefault,
    defaultPageSize: 'A4', defaultPageOrientation: 'P',
    variables: docVarsBase.concat(['doc.banco', 'doc.cuenta']),
  },
  // ── ACC ────────────────────────────────────────────────────────────
  'acc-documento': {
    codigo: 'acc-documento', modulo: 'ACC', nombre: 'Documento ACC (caja chica)', familia: 'documento',
    printDataPath: (id, qs) => `/acc/documentos/${encodeURIComponent(id)}/print-data/?${qs.toString()}`,
    defaultTemplate: accDocumentoDefault,
    defaultPageSize: 'A4', defaultPageOrientation: 'P',
    variables: docVarsBase,
  },
}

export function getRegistryEntry(codigo: string): RegistryEntry | undefined {
  return registry[codigo]
}

export function listRegistry(): RegistryEntry[] {
  return Object.values(registry)
}

// Documentos transaccionales por módulo que aún no tienen print-data activo —
// se muestran en el listado como "Próximamente" para tener mapa de progreso.
// (Los reportes/listados no aparecen aquí: siguen con ReportLab por decisión del usuario.)
export const PLANIFICADOS: Array<{ codigo: string; modulo: string; nombre: string }> = [
  // FAT — documentos restantes
  { codigo: 'nota-credito', modulo: 'FAT', nombre: 'Nota de Crédito' },
  { codigo: 'nota-debito', modulo: 'FAT', nombre: 'Nota de Débito' },
  { codigo: 'devolucion', modulo: 'FAT', nombre: 'Devolución' },
  // CNT
  { codigo: 'comprobante-contable', modulo: 'CNT', nombre: 'Comprobante Contable' },
  // BAN
  { codigo: 'cheque-impreso', modulo: 'BAN', nombre: 'Cheque Impreso' },
  // NOM
  { codigo: 'volante-pago', modulo: 'NOM', nombre: 'Volante de Pago' },
  { codigo: 'recibo-nomina', modulo: 'NOM', nombre: 'Recibo de Nómina' },
  // ACF
  { codigo: 'acta-activo', modulo: 'ACF', nombre: 'Acta de Activo' },
  // SDN
  { codigo: 'sdn-documento', modulo: 'SDN', nombre: 'Documento SDN' },
  // MAN
  { codigo: 'man-orden-trabajo', modulo: 'MAN', nombre: 'Orden de Trabajo MAN' },
]
