// Helpers compartidos para mostrar empaques (unidad de medida) en cualquier
// vista que tenga un Select de UM (FAT/INV: factura, conduce, cotización,
// entrada-compras, entrada-mercancia, salida-mercancia, transferencia,
// devolución suplidores, devolución ventas).
//
// El legado SIGAF presenta el empaque como un "factor" o "proporción" — un
// producto puede venir como UND (1), FUNDA (×12), CAJA (×24), o como
// fracción cuando permite_fraccion='S' (1/2 = ×0.5, 1/4 = ×0.25).

export interface EmpaqueOpt {
  empaque: number
  unidad: string
  descripcion?: string
  referencia?: string
  cant_por_emp: number
  por_defecto: boolean
  permite_fraccion?: boolean
}

/**
 * Convierte una cantidad por empaque a su representación legible.
 * - 1     -> ''        (sin multiplicador, es la unidad base)
 * - 12    -> '×12'
 * - 0.5   -> '×½'      (medio)
 * - 0.25  -> '×¼'      (un cuarto)
 * - 0.75  -> '×¾'
 * - 0.333 -> '×⅓'
 * - 0.666 -> '×⅔'
 */
export function cpeToLabel(cpe: number): string {
  if (!cpe || cpe === 1) return ''
  const fracciones: Record<string, string> = {
    '0.5':   '×½',
    '0.25':  '×¼',
    '0.75':  '×¾',
    '0.333': '×⅓',
    '0.666': '×⅔',
    '0.667': '×⅔',
    '0.125': '×⅛',
  }
  const key = cpe.toFixed(3)
  if (fracciones[key]) return fracciones[key]
  // Enteros sin decimales
  if (Number.isInteger(cpe)) return `×${cpe}`
  // Decimal corto
  const s = cpe.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
  return `×${s}`
}

/**
 * Genera el label visible para una opción de empaque en un Select.
 * Ejemplos:
 *   {descripcion:'UND',   cant_por_emp:1}              -> 'UND'
 *   {descripcion:'FUNDA', cant_por_emp:12}             -> 'FUNDA ×12'
 *   {descripcion:'CAJA',  cant_por_emp:24, referencia:'CJ'} -> 'CAJA ×24 (CJ)'
 *   {descripcion:'1/2 CAJA', cant_por_emp:0.5}         -> '1/2 CAJA ×½'
 */
export function empaqueLabel(e: Pick<EmpaqueOpt, 'descripcion' | 'unidad' | 'cant_por_emp' | 'referencia'>): string {
  const nombre = (e.descripcion || e.unidad || 'UND').trim()
  const factor = cpeToLabel(e.cant_por_emp)
  const ref = (e.referencia || '').trim()
  const parts = [nombre]
  if (factor) parts.push(factor)
  if (ref && ref !== nombre) parts.push(`(${ref})`)
  return parts.join(' ')
}

/**
 * Encuentra el empaque que matchea la unidad seleccionada en una línea.
 * Búsqueda flexible: descripcion exacta, unidad exacta, o ambas case-insensitive.
 */
export function findEmpaqueByLabel(empaques: EmpaqueOpt[], target: string): EmpaqueOpt | undefined {
  const t = (target || '').trim().toUpperCase()
  if (!t) return undefined
  return empaques.find((e) => {
    const d = (e.descripcion || '').trim().toUpperCase()
    const u = (e.unidad || '').trim().toUpperCase()
    return d === t || u === t
  })
}

/**
 * Valor canónico de un empaque para usar como `value` del Select.
 * Usamos `empaque` (PK numérico) si está, sino la descripción.
 */
export function empaqueValue(e: EmpaqueOpt): string {
  if (e.empaque != null) return String(e.empaque)
  return (e.descripcion || e.unidad || '').trim() || 'UND'
}
