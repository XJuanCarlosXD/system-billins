// Registry SOLO de DOCUMENTOS (no reportes).
// Los reportes (NCF nulos, listado facturas, kardex, balance, etc.) siguen
// generándose con los endpoints `*_pdf` ReportLab del backend — el usuario
// no quiere editarlos visualmente, así que no aparecen en /settings/pdf-templates.
import { accDocumentoDefault } from './defaults/acc-documento'
import { actaActivoDefault } from './defaults/acta-activo'
import { chequeChcDefault } from './defaults/cheque-chc'
import { comprobanteContableDefault } from './defaults/comprobante-contable'
import { comprobantePagoDefault } from './defaults/comprobante-pago'
import { conduceDefault } from './defaults/conduce'
import { cotizacionDefault } from './defaults/cotizacion'
import { cuadreCajaDefault } from './defaults/cuadre-caja'
import { cxcDocumentoDefault } from './defaults/cxc-documento'
import { cxcEstadoCuentaDefault } from './defaults/cxc-estado-cuenta'
import { cxpDocumentoDefault } from './defaults/cxp-documento'
import { cxpEstadoCuentaDefault } from './defaults/cxp-estado-cuenta'
import { facturaDefault } from './defaults/factura'
import { facturaPosDefault } from './defaults/factura-pos'
import { ordenCompraDefault } from './defaults/orden-compra'
import { requisicionCompraDefault } from './defaults/requisicion-compra'
import { invDocumentoDefault, reporteGenericoDefault } from './defaults/reporte-generico'
import { sdnNominaDefault } from './defaults/sdn-nomina'
import { volantePagoDefault } from './defaults/volante-pago'
import { accReposicionDefault } from './defaults/acc-reposicion'
import { comprobanteCompraAcfDefault } from './defaults/comprobante-compra-acf'
import { comprobanteRetiroAcfDefault } from './defaults/comprobante-retiro-acf'
import { comprobanteCierreAcfDefault } from './defaults/comprobante-cierre-acf'
import { listadoActivosAcfDefault } from './defaults/listado-activos-acf'
import { listadoDepreciacionAcfDefault } from './defaults/listado-depreciacion-acf'
import { valuacionAcfDefault } from './defaults/valuacion-acf'
import { activosPorGrupoAcfDefault } from './defaults/activos-por-grupo-acf'
import { activosPorDepartamentoAcfDefault } from './defaults/activos-por-departamento-acf'

const chcRepMovimientosDefault = reporteGenericoDefault('Movimiento de Cuenta Bancaria', [
  { campo: 'fecha', label: 'Fecha', align: 'left', format: 'date' },
  { campo: 'tipo_docu', label: 'Tipo', align: 'left' },
  { campo: 'no_docu', label: 'No.', align: 'left' },
  { campo: 'beneficiario', label: 'Beneficiario', align: 'left' },
  { campo: 'detalle1', label: 'Detalle', align: 'left' },
  { campo: 'debito', label: 'Débito', align: 'right', format: 'money' },
  { campo: 'credito', label: 'Crédito', align: 'right', format: 'money' },
  { campo: 'saldo', label: 'Saldo', align: 'right', format: 'money' },
  { campo: 'estado', label: 'Estado', align: 'left' },
])

const chcRepDiarioDefault = reporteGenericoDefault('Libro Diario Débito/Crédito', [
  { campo: 'cuenta_banco', label: 'Cuenta', align: 'left' },
  { campo: 'fecha', label: 'Fecha', align: 'left', format: 'date' },
  { campo: 'tipo_docu', label: 'Tipo', align: 'left' },
  { campo: 'no_docu', label: 'No.', align: 'left' },
  { campo: 'beneficiario', label: 'Beneficiario', align: 'left' },
  { campo: 'detalle1', label: 'Detalle', align: 'left' },
  { campo: 'debito', label: 'Débito', align: 'right', format: 'money' },
  { campo: 'credito', label: 'Crédito', align: 'right', format: 'money' },
  { campo: 'estado', label: 'Estado', align: 'left' },
])

const chcRepDisponibilidadDefault = reporteGenericoDefault('Disponibilidad Bancaria', [
  { campo: 'cuenta_banco', label: 'Cuenta', align: 'left' },
  { campo: 'moneda', label: 'Moneda', align: 'left' },
  { campo: 'periodo', label: 'Período', align: 'left' },
  { campo: 'saldo_aprox', label: 'Saldo aprox.', align: 'right', format: 'money' },
  { campo: 'che_por_entregar', label: 'Cheques por entregar', align: 'right', format: 'money' },
  { campo: 'disponible_neto', label: 'Disponible neto', align: 'right', format: 'money' },
])

const accListadoDocsDefault = reporteGenericoDefault('Listado de Documentos · Caja Chica', [
  { campo: 'no_docu', label: 'No.', align: 'left' },
  { campo: 'fecha', label: 'Fecha', align: 'left', format: 'date' },
  { campo: 'no_caja', label: 'Caja', align: 'left' },
  { campo: 'nombre_bene', label: 'Beneficiario', align: 'left' },
  { campo: 'desc_gasto', label: 'Tipo gasto', align: 'left' },
  { campo: 'ncf', label: 'NCF', align: 'left' },
  { campo: 'rnc', label: 'RNC', align: 'left' },
  { campo: 'valor', label: 'Valor', align: 'right', format: 'money' },
  { campo: 'no_reposicion', label: 'Reposic.', align: 'left' },
  { campo: 'estado', label: 'Estado', align: 'left' },
])

const accResumenGastosDefault = reporteGenericoDefault('Resumen de Gastos por Tipo · Caja Chica', [
  { campo: 'tipo_gasto', label: 'Tipo', align: 'left' },
  { campo: 'descripcion', label: 'Descripción', align: 'left' },
  { campo: 'cuenta', label: 'Cuenta', align: 'left' },
  { campo: 'centro_costo', label: 'Centro costo', align: 'left' },
  { campo: 'cantidad', label: 'Cant.', align: 'right' },
  { campo: 'total', label: 'Total', align: 'right', format: 'money' },
])

const sdnInformeNominaDefault = reporteGenericoDefault('Informe de Nómina (Fsdn207)', [
  { campo: 'no_empleado', label: 'No.', align: 'left' },
  { campo: 'nombre_empleado', label: 'Empleado', align: 'left' },
  { campo: 'cedula', label: 'Cédula', align: 'left' },
  { campo: 'no_gerencia', label: 'Ger.', align: 'left' },
  { campo: 'no_area', label: 'Área', align: 'left' },
  { campo: 'no_depto', label: 'Depto', align: 'left' },
  { campo: 'salario_mensual', label: 'Salario', align: 'right', format: 'money' },
  { campo: 'total_ingresos', label: 'Ingresos', align: 'right', format: 'money' },
  { campo: 'total_deducciones', label: 'Deducc.', align: 'right', format: 'money' },
  { campo: 'neto', label: 'Neto', align: 'right', format: 'money' },
])

const sdnRncEmpleadosDefault = reporteGenericoDefault('RNC Empleados (DGII / TSS)', [
  { campo: 'no_empleado', label: 'No.', align: 'left' },
  { campo: 'cedula', label: 'Cédula', align: 'left' },
  { campo: 'nss', label: 'NSS', align: 'left' },
  { campo: 'nombre_completo', label: 'Nombre', align: 'left' },
  { campo: 'nomina', label: 'Nómina', align: 'left' },
  { campo: 'salario_mensual', label: 'Salario', align: 'right', format: 'money' },
  { campo: 'afp', label: 'AFP', align: 'left' },
  { campo: 'ars', label: 'ARS', align: 'left' },
  { campo: 'fecha_ingreso', label: 'Ingreso', align: 'left', format: 'date' },
])

const chcRepChequesDefault = reporteGenericoDefault('Listado de Cheques y Movimientos', [
  { campo: 'documento', label: 'Documento', align: 'left' },
  { campo: 'fecha', label: 'Fecha', align: 'left', format: 'date' },
  { campo: 'cuenta_banco', label: 'Cuenta', align: 'left' },
  { campo: 'beneficiario', label: 'Beneficiario', align: 'left' },
  { campo: 'valor', label: 'Valor', align: 'right', format: 'money' },
  { campo: 'estado', label: 'Estado', align: 'left' },
  { campo: 'entregado', label: 'Entreg.', align: 'center' },
])

const cxpRepAlfabeticoDefault = reporteGenericoDefault('Listado Alfabético de Proveedores', [
  { campo: 'no_proveedor', label: 'No.', align: 'left' },
  { campo: 'nombre', label: 'Proveedor', align: 'left' },
  { campo: 'rnc', label: 'RNC', align: 'left' },
  { campo: 'telefono', label: 'Teléfono', align: 'left' },
  { campo: 'compras', label: 'Compras', align: 'right', format: 'money' },
  { campo: 'pagos', label: 'Pagos', align: 'right', format: 'money' },
  { campo: 'saldo', label: 'Saldo', align: 'right', format: 'money' },
])

const cxpRepMayorDefault = reporteGenericoDefault('Mayor Auxiliar CxP', [
  { campo: 'no_proveedor', label: 'Prov.', align: 'left' },
  { campo: 'nombre', label: 'Nombre', align: 'left' },
  { campo: 'documento', label: 'Documento', align: 'left' },
  { campo: 'fecha', label: 'Fecha', align: 'left', format: 'date' },
  { campo: 'detalle', label: 'Detalle', align: 'left' },
  { campo: 'debito', label: 'Débito', align: 'right', format: 'money' },
  { campo: 'credito', label: 'Crédito', align: 'right', format: 'money' },
  { campo: 'saldo', label: 'Saldo', align: 'right', format: 'money' },
])

const cxpRep606Default = reporteGenericoDefault('606 — Compras de Bienes y Servicios', [
  { campo: 'rnc', label: 'RNC', align: 'left' },
  { campo: 'nombre', label: 'Proveedor', align: 'left' },
  { campo: 'ncf', label: 'NCF', align: 'left' },
  { campo: 'fecha', label: 'Fecha', align: 'left', format: 'date' },
  { campo: 'monto_facturado', label: 'Monto', align: 'right', format: 'money' },
  { campo: 'itbis_facturado', label: 'ITBIS', align: 'right', format: 'money' },
  { campo: 'itbis_retenido', label: 'ITBIS Ret.', align: 'right', format: 'money' },
  { campo: 'isr_retenido', label: 'ISR Ret.', align: 'right', format: 'money' },
])

const cxpRep607Default = reporteGenericoDefault('607 — Retenciones del ISR', [
  { campo: 'rnc', label: 'RNC', align: 'left' },
  { campo: 'nombre', label: 'Proveedor', align: 'left' },
  { campo: 'ncf', label: 'NCF', align: 'left' },
  { campo: 'fecha', label: 'Fecha', align: 'left', format: 'date' },
  { campo: 'monto_pago', label: 'Monto', align: 'right', format: 'money' },
  { campo: 'isr_retenido', label: 'ISR Ret.', align: 'right', format: 'money' },
  { campo: 'itbis_retenido', label: 'ITBIS Ret.', align: 'right', format: 'money' },
])

const cxpRepCuadreDefault = reporteGenericoDefault('Cuadre Contable CxP', [
  { campo: 'cuenta', label: 'Cuenta', align: 'left' },
  { campo: 'docs', label: 'Docs', align: 'right' },
  { campo: 'debe', label: 'Debe', align: 'right', format: 'money' },
  { campo: 'haber', label: 'Haber', align: 'right', format: 'money' },
])

const cxpRepRetencionesDefault = reporteGenericoDefault('Retenciones a Proveedores', [
  { campo: 'no_proveedor', label: 'No.', align: 'left' },
  { campo: 'nombre', label: 'Proveedor', align: 'left' },
  { campo: 'rnc', label: 'RNC', align: 'left' },
  { campo: 'documentos', label: 'Docs', align: 'right' },
  { campo: 'total_itbis', label: 'ITBIS Retenido', align: 'right', format: 'money' },
  { campo: 'total_isr', label: 'ISR Retenido', align: 'right', format: 'money' },
])

const cxpRepEnvejecimientoDefault = reporteGenericoDefault('Antigüedad de Saldos CxP', [
  { campo: 'no_proveedor', label: 'No.', align: 'left' },
  { campo: 'nombre', label: 'Proveedor', align: 'left' },
  { campo: 'corriente', label: 'Corriente', align: 'right', format: 'money' },
  { campo: 'd30', label: '1-30', align: 'right', format: 'money' },
  { campo: 'd60', label: '31-60', align: 'right', format: 'money' },
  { campo: 'd90', label: '61-90', align: 'right', format: 'money' },
  { campo: 'mas90', label: '+90', align: 'right', format: 'money' },
  { campo: 'total', label: 'Total', align: 'right', format: 'money' },
])

export type DocFamily = 'documento' | 'reporte'

export type PdfTemplateDefault = {
  content?: unknown[]
  root?: unknown
  zones?: unknown
}

export type RegistryEntry = {
  codigo: string
  modulo:
    | 'FAT'
    | 'INV'
    | 'CXC'
    | 'CXP'
    | 'CNT'
    | 'BAN'
    | 'ODC'
    | 'CHC'
    | 'NOM'
    | 'ACF'
    | 'ACC'
    | 'SDN'
    | 'MAN'
  nombre: string
  familia: DocFamily
  printDataPath: (id: string, qs: URLSearchParams) => string
  defaultTemplate: PdfTemplateDefault
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
  'cia.razon_social',
  'cia.rnc',
  'cia.direccion',
  'cia.telefono',
  'cia.email',
  'cia.logo_url',
  'doc.tipo',
  'doc.numero_display',
  'doc.fecha',
  'doc.ncf_dgi',
  'doc.tipo_ncf_label',
  'doc.condicion_pago',
  'doc.forma_pago',
  'doc.vendedor',
  'doc.nota',
  'doc.anulada',
  'cliente.nombre',
  'cliente.rnc',
  'cliente.direccion',
  'cliente.telefono',
  'totales.subtotal',
  'totales.descuento',
  'totales.itbis',
  'totales.propina',
  'totales.total',
  'totales.monto_letras',
  'lineas[].codigo',
  'lineas[].descripcion',
  'lineas[].cantidad',
  'lineas[].precio',
  'lineas[].descuento',
  'lineas[].itbis',
  'lineas[].total',
]

export const registry: Record<string, RegistryEntry> = {
  // ── FAT — documentos transaccionales ───────────────────────────────
  factura: {
    codigo: 'factura',
    modulo: 'FAT',
    nombre: 'Factura A4',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/fat/documentos/${encodeURIComponent(splitTipo(id).tipo)}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: facturaDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase,
  },
  'factura-pos': {
    codigo: 'factura-pos',
    modulo: 'FAT',
    nombre: 'Factura POS 80mm',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/fat/documentos/${encodeURIComponent(splitTipo(id).tipo)}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: facturaPosDefault,
    defaultPageSize: 'POS80',
    defaultPageOrientation: 'P',
    variables: docVarsBase,
  },
  conduce: {
    codigo: 'conduce',
    modulo: 'FAT',
    nombre: 'Conduce A4',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/fat/conduces/${encodeURIComponent(splitTipo(id).tipo)}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: conduceDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase,
  },
  cotizacion: {
    codigo: 'cotizacion',
    modulo: 'FAT',
    nombre: 'Cotización A4',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/fat/conduces/${encodeURIComponent(splitTipo(id).tipo || 'CT')}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: cotizacionDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase,
  },
  // ── INV — documento (entrada/salida/ajuste/traspaso) ───────────────
  'inv-documento': {
    codigo: 'inv-documento',
    modulo: 'INV',
    nombre: 'Documento INV (entrada/salida/ajuste)',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/inv/documentos/${encodeURIComponent(splitTipo(id).tipo)}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: invDocumentoDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat([
      'doc.tipo_movi',
      'doc.tipo_transaccion',
      'doc.almacen_origen',
      'doc.almacen_destino',
      'proveedor.nombre',
      'proveedor.rnc',
    ]),
  },
  // ── CXC — todos los tipos comparten plantilla y endpoint (FCXC201 legacy) ─
  // El backend devuelve el título correcto (RECIBO DE INGRESO/NOTA DE CREDITO/etc.)
  // según TCXC_TDOCU. Solo cambia el codigo_doc en /print para que el editor
  // permita personalizar cada tipo por separado si el usuario lo necesita.
  'recibo-cobro': {
    codigo: 'recibo-cobro',
    modulo: 'CXC',
    nombre: 'Recibo de Ingreso (RI)',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/cxc/documentos/${encodeURIComponent(id)}/print-data/?${qs.toString()}`,
    defaultTemplate: cxcDocumentoDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat([
      'doc.acreditado_debitado',
      'doc.tipo_movi_label',
      'doc.hecho_por',
      'extra.saldo',
      'extra.dist_contable',
      'extra.documentos_afectados',
      'extra.total_aplicado',
      'extra.valor_recibido',
    ]),
  },
  'cxc-nota-credito': {
    codigo: 'cxc-nota-credito',
    modulo: 'CXC',
    nombre: 'Nota de Crédito CxC (NC)',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/cxc/documentos/${encodeURIComponent(id)}/print-data/?${qs.toString()}`,
    defaultTemplate: cxcDocumentoDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat([
      'extra.dist_contable',
      'extra.documentos_afectados',
    ]),
  },
  'cxc-nota-debito': {
    codigo: 'cxc-nota-debito',
    modulo: 'CXC',
    nombre: 'Nota de Débito CxC (ND)',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/cxc/documentos/${encodeURIComponent(id)}/print-data/?${qs.toString()}`,
    defaultTemplate: cxcDocumentoDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat([
      'extra.dist_contable',
      'extra.documentos_afectados',
    ]),
  },
  'cxc-cheque-devuelto': {
    codigo: 'cxc-cheque-devuelto',
    modulo: 'CXC',
    nombre: 'Cheque Devuelto CxC (CD)',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/cxc/documentos/${encodeURIComponent(id)}/print-data/?${qs.toString()}`,
    defaultTemplate: cxcDocumentoDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat(['extra.dist_contable']),
  },
  'cxc-ajuste-credito': {
    codigo: 'cxc-ajuste-credito',
    modulo: 'CXC',
    nombre: 'Ajuste Crédito CxC (AC)',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/cxc/documentos/${encodeURIComponent(id)}/print-data/?${qs.toString()}`,
    defaultTemplate: cxcDocumentoDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat(['extra.dist_contable']),
  },
  'cxc-ajuste-debito': {
    codigo: 'cxc-ajuste-debito',
    modulo: 'CXC',
    nombre: 'Ajuste Débito CxC (AD)',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/cxc/documentos/${encodeURIComponent(id)}/print-data/?${qs.toString()}`,
    defaultTemplate: cxcDocumentoDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat(['extra.dist_contable']),
  },
  'cxc-devolucion': {
    codigo: 'cxc-devolucion',
    modulo: 'CXC',
    nombre: 'Devolución CxC (DV)',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/cxc/documentos/${encodeURIComponent(id)}/print-data/?${qs.toString()}`,
    defaultTemplate: cxcDocumentoDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat(['extra.dist_contable']),
  },
  'cxc-anulacion-factura': {
    codigo: 'cxc-anulacion-factura',
    modulo: 'CXC',
    nombre: 'Anulación Factura CxC (AF)',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/cxc/documentos/${encodeURIComponent(id)}/print-data/?${qs.toString()}`,
    defaultTemplate: cxcDocumentoDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat(['extra.dist_contable']),
  },
  'cxc-balance-inicial': {
    codigo: 'cxc-balance-inicial',
    modulo: 'CXC',
    nombre: 'Balance Inicial CxC (BI)',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/cxc/documentos/${encodeURIComponent(id)}/print-data/?${qs.toString()}`,
    defaultTemplate: cxcDocumentoDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat(['extra.dist_contable']),
  },
  'cxc-estado-cuenta': {
    codigo: 'cxc-estado-cuenta',
    modulo: 'CXC',
    nombre: 'Estado de Cuenta CxC',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/cxc/clientes/${encodeURIComponent(id)}/estado-cuenta/print-data/?${qs.toString()}`,
    defaultTemplate: cxcEstadoCuentaDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'L',
    variables: docVarsBase.concat([
      'cliente.no_cliente',
      'cliente.vendedor',
      'cliente.dias',
      'totales.total_debito',
      'totales.total_credito',
      'totales.total_pendiente',
      'aging.d_0_30',
      'aging.d_31_60',
      'aging.d_61_90',
      'aging.d_mas_90',
      'documentos[].numero_display',
      'documentos[].tipo_label',
      'documentos[].fecha',
      'documentos[].valor',
      'documentos[].saldo',
      'documentos[].dias_vencido',
      'documentos[].ncf',
      'documentos[].detalle',
    ]),
  },
  // ── CXP — todos los tipos comparten plantilla y endpoint (Rcxp207 legacy) ─
  // Backend resuelve título y "Acreditado/Debitado" desde TCXP_TDOCU y
  // tipo_movi. Cada tipo tiene su código en /print para que el editor de
  // plantillas pueda personalizar uno por separado si el usuario quiere.
  'comprobante-pago': {
    codigo: 'comprobante-pago',
    modulo: 'CXP',
    nombre: 'Comprobante de Pago',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/cxp/documentos/${encodeURIComponent(splitTipo(id).tipo)}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: comprobantePagoDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat([
      'proveedor.nombre',
      'proveedor.rnc',
      'extra.saldo',
    ]),
  },
  'cxp-factura-proveedor': {
    codigo: 'cxp-factura-proveedor',
    modulo: 'CXP',
    nombre: 'Factura Proveedor (FP)',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/cxp/documentos/${encodeURIComponent(splitTipo(id).tipo)}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: cxpDocumentoDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat([
      'doc.acreditado_debitado',
      'doc.fecha_larga',
      'doc.hecho_por',
      'proveedor.nombre',
      'proveedor.rnc',
      'proveedor.direccion',
      'proveedor.telefono',
      'totales.total_padded',
      'extra.documentos_afectados',
      'extra.dist_contable',
      'extra.mostrar_recibido_conforme',
    ]),
  },
  'cxp-ajuste-credito': {
    codigo: 'cxp-ajuste-credito',
    modulo: 'CXP',
    nombre: 'Ajuste Crédito CxP (AC)',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/cxp/documentos/${encodeURIComponent(splitTipo(id).tipo)}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: cxpDocumentoDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat(['proveedor.nombre', 'extra.dist_contable']),
  },
  'cxp-ajuste-debito': {
    codigo: 'cxp-ajuste-debito',
    modulo: 'CXP',
    nombre: 'Ajuste Débito CxP (AD)',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/cxp/documentos/${encodeURIComponent(splitTipo(id).tipo)}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: cxpDocumentoDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat(['proveedor.nombre', 'extra.dist_contable']),
  },
  'cxp-balance-debito': {
    codigo: 'cxp-balance-debito',
    modulo: 'CXP',
    nombre: 'Balance Débito CxP (BD)',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/cxp/documentos/${encodeURIComponent(splitTipo(id).tipo)}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: cxpDocumentoDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat(['proveedor.nombre', 'extra.dist_contable']),
  },
  'cxp-nota-credito': {
    codigo: 'cxp-nota-credito',
    modulo: 'CXP',
    nombre: 'Nota de Crédito CxP (NC)',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/cxp/documentos/${encodeURIComponent(splitTipo(id).tipo)}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: cxpDocumentoDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat(['proveedor.nombre', 'extra.dist_contable']),
  },
  'cxp-nota-debito': {
    codigo: 'cxp-nota-debito',
    modulo: 'CXP',
    nombre: 'Nota de Débito CxP (ND)',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/cxp/documentos/${encodeURIComponent(splitTipo(id).tipo)}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: cxpDocumentoDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat(['proveedor.nombre', 'extra.dist_contable']),
  },
  'cxp-solicitud-cheque': {
    codigo: 'cxp-solicitud-cheque',
    modulo: 'CXP',
    nombre: 'Solicitud de Cheque (SO)',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/cxp/documentos/${encodeURIComponent(splitTipo(id).tipo)}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: cxpDocumentoDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat([
      'proveedor.nombre',
      'extra.dist_contable',
      'extra.documentos_afectados',
    ]),
  },
  'cxp-estado-cuenta': {
    codigo: 'cxp-estado-cuenta',
    modulo: 'CXP',
    nombre: 'Estado de Cuenta CxP',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/cxp/proveedores/${encodeURIComponent(id)}/estado-cuenta/print-data/?${qs.toString()}`,
    defaultTemplate: cxpEstadoCuentaDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'L',
    variables: docVarsBase.concat([
      'proveedor.no_proveedor',
      'proveedor.encargado',
      'proveedor.dias',
      'totales.total_debito',
      'totales.total_credito',
      'totales.total_pendiente',
      'aging.d_0_30',
      'aging.d_31_60',
      'aging.d_61_90',
      'aging.d_mas_90',
      'documentos[].numero_display',
      'documentos[].tipo_label',
      'documentos[].fecha',
      'documentos[].valor',
      'documentos[].saldo',
      'documentos[].dias_vencido',
      'documentos[].ncf',
      'documentos[].detalle',
    ]),
  },
  'cxp-rep-alfabetico': {
    codigo: 'cxp-rep-alfabetico',
    modulo: 'CXP',
    nombre: 'Listado Alfabético de Proveedores (Rcxp306)',
    familia: 'reporte',
    printDataPath: (_id, qs) => `/cxp/rep-alfabetico/print-data/?${qs.toString()}`,
    defaultTemplate: cxpRepAlfabeticoDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'L',
    variables: [
      'reporte.titulo', 'reporte.filtros',
      'filas[].no_proveedor', 'filas[].nombre', 'filas[].rnc', 'filas[].telefono',
      'filas[].compras', 'filas[].pagos', 'filas[].saldo',
      'totales.cantidad', 'totales.total',
    ],
  },
  'cxp-rep-mayor': {
    codigo: 'cxp-rep-mayor',
    modulo: 'CXP',
    nombre: 'Mayor Auxiliar CxP (Rcxp308)',
    familia: 'reporte',
    printDataPath: (_id, qs) => `/cxp/rep-mayor/print-data/?${qs.toString()}`,
    defaultTemplate: cxpRepMayorDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'L',
    variables: [
      'reporte.titulo', 'reporte.filtros',
      'filas[].no_proveedor', 'filas[].nombre', 'filas[].documento', 'filas[].fecha',
      'filas[].detalle', 'filas[].debito', 'filas[].credito', 'filas[].saldo',
      'totales.cantidad', 'totales.total_debito', 'totales.total_credito',
    ],
  },
  'cxp-rep-606': {
    codigo: 'cxp-rep-606',
    modulo: 'CXP',
    nombre: '606 — Compras de Bienes y Servicios (DGII)',
    familia: 'reporte',
    printDataPath: (_id, qs) => `/cxp/rep-606/print-data/?${qs.toString()}`,
    defaultTemplate: cxpRep606Default,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'L',
    variables: [
      'reporte.titulo', 'reporte.filtros',
      'filas[].rnc', 'filas[].nombre', 'filas[].ncf', 'filas[].fecha',
      'filas[].monto_facturado', 'filas[].itbis_facturado',
      'filas[].itbis_retenido', 'filas[].isr_retenido',
      'totales.cantidad', 'totales.total_monto', 'totales.total_itbis',
    ],
  },
  'cxp-rep-607': {
    codigo: 'cxp-rep-607',
    modulo: 'CXP',
    nombre: '607 — Retenciones del ISR (DGII)',
    familia: 'reporte',
    printDataPath: (_id, qs) => `/cxp/rep-607/print-data/?${qs.toString()}`,
    defaultTemplate: cxpRep607Default,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'L',
    variables: [
      'reporte.titulo', 'reporte.filtros',
      'filas[].rnc', 'filas[].nombre', 'filas[].ncf', 'filas[].fecha',
      'filas[].monto_pago', 'filas[].isr_retenido', 'filas[].itbis_retenido',
      'totales.cantidad', 'totales.total_isr', 'totales.total_itbis',
    ],
  },
  'cxp-rep-cuadre': {
    codigo: 'cxp-rep-cuadre',
    modulo: 'CXP',
    nombre: 'Cuadre Contable CxP (Rcxp105)',
    familia: 'reporte',
    printDataPath: (_id, qs) => `/cxp/rep-cuadre/print-data/?${qs.toString()}`,
    defaultTemplate: cxpRepCuadreDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: [
      'reporte.titulo', 'reporte.filtros',
      'filas[].cuenta', 'filas[].docs', 'filas[].debe', 'filas[].haber',
      'totales.cantidad', 'totales.total_debe', 'totales.total_haber',
      'totales.diferencia',
    ],
  },
  'cxp-rep-retenciones': {
    codigo: 'cxp-rep-retenciones',
    modulo: 'CXP',
    nombre: 'Retenciones a Proveedores (Rcxp108)',
    familia: 'reporte',
    printDataPath: (_id, qs) => `/cxp/rep-retenciones/print-data/?${qs.toString()}`,
    defaultTemplate: cxpRepRetencionesDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: [
      'reporte.titulo', 'reporte.filtros',
      'filas[].no_proveedor', 'filas[].nombre', 'filas[].rnc', 'filas[].documentos',
      'filas[].total_itbis', 'filas[].total_isr',
      'totales.cantidad', 'totales.total_itbis', 'totales.total_isr',
    ],
  },
  'cxp-rep-envejecimiento': {
    codigo: 'cxp-rep-envejecimiento',
    modulo: 'CXP',
    nombre: 'Antigüedad de Saldos CxP (Rcxp503)',
    familia: 'reporte',
    printDataPath: (_id, qs) => `/cxp/rep-envejecimiento/print-data/?${qs.toString()}`,
    defaultTemplate: cxpRepEnvejecimientoDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'L',
    variables: [
      'reporte.titulo', 'reporte.filtros',
      'filas[].no_proveedor', 'filas[].nombre', 'filas[].corriente',
      'filas[].d30', 'filas[].d60', 'filas[].d90', 'filas[].mas90', 'filas[].total',
      'totales.cantidad', 'totales.total',
    ],
  },
  // ── ODC ────────────────────────────────────────────────────────────
  'orden-compra': {
    codigo: 'orden-compra',
    modulo: 'ODC',
    nombre: 'Orden de Compra',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/odc/ordenes/${encodeURIComponent(id)}/print-data/?${qs.toString()}`,
    defaultTemplate: ordenCompraDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat(['proveedor.nombre', 'proveedor.rnc']),
  },
  'requisicion-compra': {
    codigo: 'requisicion-compra',
    modulo: 'ODC',
    nombre: 'Requisición Interna',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/odc/requisiciones/${encodeURIComponent(id)}/print-data/?${qs.toString()}`,
    defaultTemplate: requisicionCompraDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat([
      'doc.no_localidad', 'doc.no_depto', 'doc.estado_label',
      'totales.cantidad_total', 'totales.lineas_total',
    ]),
  },
  // ── CHC ────────────────────────────────────────────────────────────
  'cheque-caja-chica': {
    codigo: 'cheque-caja-chica',
    modulo: 'CHC',
    nombre: 'Cheque / Comprobante CHC',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/chc/cheques/${encodeURIComponent(splitTipo(id).tipo)}/${encodeURIComponent(splitTipo(id).no)}/print-data/?${qs.toString()}`,
    defaultTemplate: chequeChcDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat(['doc.banco', 'doc.cuenta']),
  },
  // ── ACC ────────────────────────────────────────────────────────────
  'acc-reposicion': {
    codigo: 'acc-reposicion',
    modulo: 'ACC',
    nombre: 'Reposición de Caja Chica',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/acc/reposiciones/${encodeURIComponent(id)}/print-data/?${qs.toString()}`,
    defaultTemplate: accReposicionDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat([
      'extra.cuenta_banco', 'extra.no_cheque',
      'extra.tipo_docu_chc', 'extra.no_docu_chc',
      'totales.efectivo', 'totales.valor_compro_prov', 'totales.cantidad_docs',
      'cliente.no_caja', 'cliente.usuario',
    ]),
  },
  'chc-rep-cheques': {
    codigo: 'chc-rep-cheques',
    modulo: 'CHC',
    nombre: 'Listado de Cheques y Movimientos (Rchc503)',
    familia: 'reporte',
    printDataPath: (_id, qs) => `/chc/cheques/print-data/?${qs.toString()}`,
    defaultTemplate: chcRepChequesDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'L',
    variables: [
      'reporte.titulo', 'reporte.filtros',
      'filas[].documento', 'filas[].fecha', 'filas[].cuenta_banco',
      'filas[].beneficiario', 'filas[].valor', 'filas[].estado', 'filas[].entregado',
      'totales.cantidad', 'totales.total',
    ],
  },
  'chc-rep-movimientos': {
    codigo: 'chc-rep-movimientos',
    modulo: 'CHC',
    nombre: 'Movimiento de Cuenta Bancaria (Rchc501)',
    familia: 'reporte',
    printDataPath: (_id, qs) => `/chc/rep-movimientos/print-data/?${qs.toString()}`,
    defaultTemplate: chcRepMovimientosDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'L',
    variables: [
      'reporte.titulo', 'reporte.filtros',
      'filas[].fecha', 'filas[].tipo_docu', 'filas[].no_docu', 'filas[].beneficiario',
      'filas[].detalle1', 'filas[].debito', 'filas[].credito', 'filas[].saldo', 'filas[].estado',
      'totales.cantidad', 'totales.saldo_inicial', 'totales.total_debito',
      'totales.total_credito', 'totales.saldo_final',
    ],
  },
  'chc-rep-diario': {
    codigo: 'chc-rep-diario',
    modulo: 'CHC',
    nombre: 'Libro Diario Débito/Crédito (Rchc202/203/218/219)',
    familia: 'reporte',
    printDataPath: (_id, qs) => `/chc/rep-diario/print-data/?${qs.toString()}`,
    defaultTemplate: chcRepDiarioDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'L',
    variables: [
      'reporte.titulo', 'reporte.filtros',
      'filas[].cuenta_banco', 'filas[].fecha', 'filas[].tipo_docu', 'filas[].no_docu',
      'filas[].beneficiario', 'filas[].detalle1',
      'filas[].debito', 'filas[].credito', 'filas[].estado',
      'totales.cantidad', 'totales.activos', 'totales.nulos',
      'totales.total_debito', 'totales.total_credito', 'totales.neto',
    ],
  },
  'chc-rep-disponibilidad': {
    codigo: 'chc-rep-disponibilidad',
    modulo: 'CHC',
    nombre: 'Disponibilidad Bancaria (Rchc505)',
    familia: 'reporte',
    printDataPath: (_id, qs) => `/chc/rep-disponibilidad/print-data/?${qs.toString()}`,
    defaultTemplate: chcRepDisponibilidadDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: [
      'reporte.titulo', 'reporte.filtros',
      'filas[].cuenta_banco', 'filas[].moneda', 'filas[].periodo',
      'filas[].saldo_aprox', 'filas[].che_por_entregar', 'filas[].disponible_neto',
      'totales.cantidad', 'totales.total_saldo_dop',
      'totales.total_che_por_entregar_dop', 'totales.total_disponible_dop',
    ],
  },
  'acc-listado-documentos': {
    codigo: 'acc-listado-documentos',
    modulo: 'ACC',
    nombre: 'Listado de Documentos · Caja Chica',
    familia: 'reporte',
    printDataPath: (_id, qs) => `/acc/documentos/listado/print-data/?${qs.toString()}`,
    defaultTemplate: accListadoDocsDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'L',
    variables: [
      'reporte.titulo', 'reporte.filtros',
      'filas[].no_docu', 'filas[].fecha', 'filas[].nombre_bene',
      'filas[].desc_gasto', 'filas[].ncf', 'filas[].rnc', 'filas[].valor',
      'filas[].no_reposicion', 'filas[].estado',
      'totales.cantidad', 'totales.activos', 'totales.anulados', 'totales.valor',
    ],
  },
  'acc-resumen-gastos': {
    codigo: 'acc-resumen-gastos',
    modulo: 'ACC',
    nombre: 'Resumen de Gastos por Tipo · Caja Chica',
    familia: 'reporte',
    printDataPath: (_id, qs) => `/acc/rep-resumen/print-data/?${qs.toString()}`,
    defaultTemplate: accResumenGastosDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: [
      'reporte.titulo', 'reporte.filtros',
      'filas[].tipo_gasto', 'filas[].descripcion', 'filas[].cantidad', 'filas[].total',
      'totales.cantidad', 'totales.monto_total', 'totales.impuesto_total',
    ],
  },
  'acc-documento': {
    codigo: 'acc-documento',
    modulo: 'ACC',
    nombre: 'Documento ACC (caja chica)',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/acc/documentos/${encodeURIComponent(id)}/print-data/?${qs.toString()}`,
    defaultTemplate: accDocumentoDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase,
  },
  // ── CNT ────────────────────────────────────────────────────────────
  // id encoding: ANO-MES-NO_ASIENTO (e.g. 2026-06-00123)
  'comprobante-contable': {
    codigo: 'comprobante-contable',
    modulo: 'CNT',
    nombre: 'Comprobante Contable',
    familia: 'documento',
    printDataPath: (id, qs) => {
      const [ano, mes, no] = id.split('-')
      return `/cnt/asientos/${encodeURIComponent(ano)}/${encodeURIComponent(mes)}/${encodeURIComponent(no)}/print-data/?${qs.toString()}`
    },
    defaultTemplate: comprobanteContableDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat([
      'doc.periodo',
      'extra.debitos',
      'extra.creditos',
      'extra.diferencia',
    ]),
  },
  // ── ACF ────────────────────────────────────────────────────────────
  'acta-activo': {
    codigo: 'acta-activo',
    modulo: 'ACF',
    nombre: 'Acta de Activo Fijo',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/acf/activos/${encodeURIComponent(id)}/print-data/?${qs.toString()}`,
    defaultTemplate: actaActivoDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat([
      'doc.grupo',
      'doc.ubicacion',
      'doc.serial',
      'doc.marca',
      'doc.modelo',
      'extra.depreciacion_acum',
      'extra.valor_residual',
      'extra.vida_util',
    ]),
  },
  'comprobante-compra-acf': {
    codigo: 'comprobante-compra-acf',
    modulo: 'ACF',
    nombre: 'Comprobante de Compra · Activo Fijo',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/acf/comprobante-compra/${encodeURIComponent(id)}/print-data/?${qs.toString()}`,
    defaultTemplate: comprobanteCompraAcfDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat([
      'doc.no_activo', 'doc.descripcion_activo', 'doc.serie',
      'doc.duracion_ano', 'doc.departamento', 'doc.responsable',
      'doc.cuenta_contable',
    ]),
  },
  'comprobante-retiro-acf': {
    codigo: 'comprobante-retiro-acf',
    modulo: 'ACF',
    nombre: 'Comprobante de Retiro · Activo Fijo',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/acf/comprobante-retiro/${encodeURIComponent(id)}/print-data/?${qs.toString()}`,
    defaultTemplate: comprobanteRetiroAcfDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat([
      'doc.no_activo', 'doc.descripcion_activo', 'doc.serie',
      'doc.departamento', 'doc.responsable', 'doc.cuenta_contable',
      'extra.valor_original', 'extra.depre_acumu', 'extra.valor_libro',
    ]),
  },
  'comprobante-cierre-acf': {
    codigo: 'comprobante-cierre-acf',
    modulo: 'ACF',
    nombre: 'Comprobante de Cierre Mensual ACF',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/acf/comprobante-cierre/${encodeURIComponent(id)}/print-data/?${qs.toString()}`,
    defaultTemplate: comprobanteCierreAcfDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat([
      'doc.periodo', 'extra.usuario_cierre', 'extra.fecha_cierre',
      'extra.activos_depreciados', 'extra.mes_label',
    ]),
  },
  'listado-activos-acf': {
    codigo: 'listado-activos-acf',
    modulo: 'ACF',
    nombre: 'Listado de Activos Fijos',
    familia: 'reporte',
    printDataPath: (_id, qs) => `/acf/rep-listado/print-data/?${qs.toString()}`,
    defaultTemplate: listadoActivosAcfDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'L',
    variables: [
      'cia.razon_social', 'cia.rnc', 'reporte.titulo', 'reporte.filtros',
      'totales.cantidad', 'totales.valor_original', 'totales.depre_acumu',
      'totales.valor_libros',
    ],
  },
  'listado-depreciacion-acf': {
    codigo: 'listado-depreciacion-acf',
    modulo: 'ACF',
    nombre: 'Listado de Depreciación Mensual',
    familia: 'reporte',
    printDataPath: (id, qs) =>
      `/acf/rep-depreciacion/${encodeURIComponent(id)}/print-data/?${qs.toString()}`,
    defaultTemplate: listadoDepreciacionAcfDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'L',
    variables: [
      'cia.razon_social', 'cia.rnc', 'reporte.titulo', 'reporte.filtros',
      'totales.cantidad', 'totales.total_depreciado',
    ],
  },
  'valuacion-acf': {
    codigo: 'valuacion-acf',
    modulo: 'ACF',
    nombre: 'Valuación Contable · ACF',
    familia: 'reporte',
    printDataPath: (_id, qs) => `/acf/rep-valuacion/print-data/?${qs.toString()}`,
    defaultTemplate: valuacionAcfDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: [
      'cia.razon_social', 'cia.rnc', 'reporte.titulo', 'reporte.filtros',
      'totales.cantidad', 'totales.valor_original', 'totales.mejoras',
      'totales.revalorizacion', 'totales.depre_acumu', 'totales.valor_libros',
    ],
  },
  'activos-por-grupo-acf': {
    codigo: 'activos-por-grupo-acf',
    modulo: 'ACF',
    nombre: 'Activos por Grupo',
    familia: 'reporte',
    printDataPath: (_id, qs) => `/acf/rep-por-grupo/print-data/?${qs.toString()}`,
    defaultTemplate: activosPorGrupoAcfDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: [
      'cia.razon_social', 'cia.rnc', 'reporte.titulo', 'reporte.filtros',
      'totales.cantidad',
    ],
  },
  'activos-por-departamento-acf': {
    codigo: 'activos-por-departamento-acf',
    modulo: 'ACF',
    nombre: 'Activos por Departamento',
    familia: 'reporte',
    printDataPath: (_id, qs) => `/acf/rep-por-departamento/print-data/?${qs.toString()}`,
    defaultTemplate: activosPorDepartamentoAcfDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'L',
    variables: [
      'cia.razon_social', 'cia.rnc', 'reporte.titulo', 'reporte.filtros',
      'totales.cantidad', 'totales.valor_original', 'totales.depre_acumu',
      'totales.valor_libros',
    ],
  },
  // ── FAT — reporte: Cuadre de Caja (familia 'reporte') ──────────────
  // id = fecha YYYY-MM-DD. Para incluir detalle de facturas se pasa
  // `incluir_detalle=1` en la qs (via extra de PrintPage).
  'cuadre-caja': {
    codigo: 'cuadre-caja',
    modulo: 'FAT',
    nombre: 'Cuadre de Caja',
    familia: 'reporte',
    printDataPath: (id, qs) => {
      const p = new URLSearchParams(qs)
      p.set('fecha', id)
      return `/fat/reportes/cuadre-caja/print-data/?${p.toString()}`
    },
    defaultTemplate: cuadreCajaDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: [
      'cia.razon_social',
      'cia.rnc',
      'cia.direccion',
      'cia.telefono',
      'cia.logo_url',
      'reporte.titulo',
      'reporte.filtros',
      'extra.fecha',
      'extra.usuario',
      'extra.no_cuadre',
      'extra.resumen_ventas[].clase',
      'extra.resumen_ventas[].descripcion',
      'extra.resumen_ventas[].cantidad',
      'extra.resumen_ventas[].total',
      'extra.resumen_pago[].tipo_pago',
      'extra.resumen_pago[].forma_pago',
      'extra.resumen_pago[].cantidad',
      'extra.resumen_pago[].total',
      'extra.por_ncf[].ncf_tipo',
      'extra.por_ncf[].cantidad',
      'extra.por_ncf[].total_linea',
      'extra.por_ncf[].descuento',
      'extra.por_ncf[].impuesto',
      'extra.por_ncf[].total_neto',
      'extra.por_ncf_forma_pago[].ncf_tipo',
      'extra.por_ncf_forma_pago[].tipo_pago',
      'extra.por_ncf_forma_pago[].forma_pago',
      'extra.por_ncf_forma_pago[].total',
      'extra.facturas[].no_factura',
      'extra.facturas[].fecha',
      'extra.facturas[].nombre_cliente',
      'extra.facturas[].ncf_dgi',
      'extra.facturas[].total_neto',
    ],
  },
  // ── SDN ────────────────────────────────────────────────────────────
  'sdn-nomina': {
    codigo: 'sdn-nomina',
    modulo: 'SDN',
    nombre: 'Cabecera de Nómina',
    familia: 'documento',
    printDataPath: (id, qs) =>
      `/sdn/nominas/${encodeURIComponent(id)}/print-data/?${qs.toString()}`,
    defaultTemplate: sdnNominaDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat([
      'doc.periodo',
      'extra.cuenta_contable',
      'extra.cuenta_bancaria',
    ]),
  },
  'volante-pago': {
    codigo: 'volante-pago',
    modulo: 'SDN',
    nombre: 'Volante de Pago (individual)',
    familia: 'documento',
    // id viene como `<nomina>__<no_empleado>` y se separa aquí.
    printDataPath: (id, qs) => {
      const [nom, emp] = (id || '').split('__')
      return `/sdn/nominas/${encodeURIComponent(nom)}/empleado/${encodeURIComponent(emp || '')}/print-data/?${qs.toString()}`
    },
    defaultTemplate: volantePagoDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'P',
    variables: docVarsBase.concat([
      'doc.periodo', 'doc.nomina',
      'cliente.cedula', 'cliente.nss', 'cliente.cargo', 'cliente.depto',
      'totales.salario_base', 'totales.total_ingresos', 'totales.total_deducciones', 'totales.bruto',
      'extra.cuenta_bancaria', 'extra.moneda_label',
    ]),
  },
  'sdn-informe-nomina': {
    codigo: 'sdn-informe-nomina',
    modulo: 'SDN',
    nombre: 'Informe de Nómina (Fsdn207)',
    familia: 'reporte',
    // id no se usa para reportes — la query lleva los filtros.
    printDataPath: (_id, qs) => `/sdn/informe-nomina/print-data/?${qs.toString()}`,
    defaultTemplate: sdnInformeNominaDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'L',
    variables: [
      'reporte.titulo', 'reporte.filtros',
      'filas[].no_empleado', 'filas[].nombre_empleado', 'filas[].cedula',
      'filas[].salario_mensual', 'filas[].total_ingresos', 'filas[].total_deducciones', 'filas[].neto',
      'totales.cantidad', 'totales.salario', 'totales.ingresos', 'totales.deducciones', 'totales.neto',
    ],
  },
  'sdn-rnc-empleados': {
    codigo: 'sdn-rnc-empleados',
    modulo: 'SDN',
    nombre: 'RNC Empleados (DGII / TSS)',
    familia: 'reporte',
    printDataPath: (_id, qs) => `/sdn/rnc-empleados/print-data/?${qs.toString()}`,
    defaultTemplate: sdnRncEmpleadosDefault,
    defaultPageSize: 'A4',
    defaultPageOrientation: 'L',
    variables: [
      'reporte.titulo', 'reporte.filtros',
      'filas[].no_empleado', 'filas[].cedula', 'filas[].nss', 'filas[].nombre_completo',
      'filas[].nomina', 'filas[].salario_mensual', 'filas[].afp', 'filas[].ars',
      'filas[].fecha_ingreso',
      'totales.cantidad', 'totales.masa_salarial',
    ],
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
export const PLANIFICADOS: Array<{
  codigo: string
  modulo: string
  nombre: string
}> = [
  // FAT — documentos restantes
  { codigo: 'nota-credito', modulo: 'FAT', nombre: 'Nota de Crédito' },
  { codigo: 'nota-debito', modulo: 'FAT', nombre: 'Nota de Débito' },
  { codigo: 'devolucion', modulo: 'FAT', nombre: 'Devolución' },
  // NOM — Volante individual (por empleado)
  {
    codigo: 'volante-pago',
    modulo: 'NOM',
    nombre: 'Volante de Pago (individual)',
  },
  // MAN
  {
    codigo: 'man-orden-trabajo',
    modulo: 'MAN',
    nombre: 'Orden de Trabajo MAN',
  },
  // BAN — Cheque bancario (no caja chica)
  {
    codigo: 'cheque-impreso',
    modulo: 'BAN',
    nombre: 'Cheque Bancario (formato bancario)',
  },
]
