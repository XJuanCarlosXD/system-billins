// Fuente de datos y almacenamiento "visto/no visto" para los badges del
// sidebar (contadores circulares). Tres orígenes:
//   • Novedades  — arreglo estático NOVEDADES (frontend).
//   • Reportes   — lista de tickets (estado abierto / completado).
//   • Documentos — conteos por módulo desde /api/sidebar/badges/.
// El "delta desde la última visita" se calcula contra los valores guardados
// en localStorage; al entrar a la vista correspondiente se actualiza el
// valor visto y el badge desaparece.
import { NOVEDADES } from '@/data/novedades'

const API_BASE =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

export type BadgeVariant = 'default' | 'warning' | 'success'

/** Módulos documentales con contador de "documentos nuevos". */
export const DOC_MODULES = ['fat', 'cxc', 'cxp', 'inv'] as const
export type DocModule = (typeof DOC_MODULES)[number]

export type DocCounts = Record<DocModule, number | null>

/** Ruta de la consulta que "limpia" el contador de cada módulo. */
export const CONSULTA_PATHS: Record<DocModule, string> = {
  fat: '/fat/facturas',
  cxc: '/cxc/documentos',
  cxp: '/cxp/documentos',
  inv: '/inv/consulta-documentos',
}

export const NOVEDADES_TOTAL = NOVEDADES.length

export async function fetchDocCounts(
  no_cia: string,
  punto: string
): Promise<DocCounts> {
  const res = await fetch(
    `${API_BASE}/sidebar/badges/?no_cia=${encodeURIComponent(
      no_cia
    )}&punto=${encodeURIComponent(punto)}`,
    { credentials: 'include' }
  )
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  const c = (body && body.counts) || {}
  return {
    fat: c.fat ?? null,
    cxc: c.cxc ?? null,
    cxp: c.cxp ?? null,
    inv: c.inv ?? null,
  }
}

/**
 * Clase para resaltar filas/tarjetas NUEVAS (no vistas) sin opacarlas, con
 * buen contraste en light y dark mode. Fondo brillante + borde de acento.
 */
export const HIGHLIGHT_ROW_CLASS =
  'bg-emerald-100/70 dark:bg-emerald-400/10 [&>td:first-child]:border-s-2 [&>td:first-child]:border-emerald-500'

/** Clase para resaltar una tarjeta nueva (Novedades). */
export const HIGHLIGHT_CARD_CLASS =
  'ring-2 ring-emerald-500/60 bg-emerald-50/60 dark:bg-emerald-400/5'

// ---- almacenamiento local "visto" -----------------------------------------
const KEYS = {
  novedades: 'zerp.badges.novedades.seen',
  novedadesHl: 'zerp.badges.novedades.hl',
  reportesDone: 'zerp.badges.reportes.doneSeen',
  docTotal: (cia: string, code: string) =>
    `zerp.badges.doc.${cia}.${code}.seenTotal`,
  docHl: (cia: string, code: string) => `zerp.badges.doc.${cia}.${code}.hl`,
}

function readNum(key: string): number | null {
  try {
    const v = localStorage.getItem(key)
    return v == null ? null : Number(v)
  } catch {
    return null
  }
}
function writeNum(key: string, v: number) {
  try {
    localStorage.setItem(key, String(v))
  } catch {
    /* ignore */
  }
}

export const seenStore = {
  novedadesSeen: () => readNum(KEYS.novedades),
  setNovedadesSeen: (n: number) => writeNum(KEYS.novedades, n),
  novedadesHighlight: () => readNum(KEYS.novedadesHl) ?? 0,
  setNovedadesHighlight: (n: number) => writeNum(KEYS.novedadesHl, n),
  reportesDoneSeen: () => readNum(KEYS.reportesDone),
  setReportesDoneSeen: (n: number) => writeNum(KEYS.reportesDone, n),
  docSeenTotal: (cia: string, code: string) => readNum(KEYS.docTotal(cia, code)),
  setDocSeenTotal: (cia: string, code: string, n: number) =>
    writeNum(KEYS.docTotal(cia, code), n),
  docHighlight: (cia: string, code: string) =>
    readNum(KEYS.docHl(cia, code)) ?? 0,
  setDocHighlight: (cia: string, code: string, n: number) =>
    writeNum(KEYS.docHl(cia, code), n),
}
