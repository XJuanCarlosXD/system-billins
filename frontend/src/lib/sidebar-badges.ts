// Fuente de datos y almacenamiento "visto/no visto" para los badges del
// sidebar (contadores circulares). Tres orígenes:
//   • Novedades  — arreglo estático NOVEDADES (frontend).
//   • Reportes   — lista de tickets (estado abierto / completado).
//   • Documentos — conteos por módulo desde /api/sidebar/badges/.
// El "delta desde la última visita" se calcula contra los valores guardados
// en localStorage; al entrar a la vista correspondiente se actualiza el
// valor visto y el badge desaparece.
import { NOVEDADES } from '@/data/novedades'

const META = import.meta as unknown as {
  env?: { VITE_API_BASE_URL?: string }
}
const API_BASE = META.env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

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
  inv: '/inv', // + ?section=consultas&view=consulta-documentos
}

export const INV_CONSULTA_VIEW = 'consulta-documentos'

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

// ---- almacenamiento local "visto" -----------------------------------------
const KEYS = {
  novedades: 'zerp.badges.novedades.seen',
  reportesDone: 'zerp.badges.reportes.doneSeen',
  docTotal: (cia: string, code: string) =>
    `zerp.badges.doc.${cia}.${code}.seenTotal`,
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
  reportesDoneSeen: () => readNum(KEYS.reportesDone),
  setReportesDoneSeen: (n: number) => writeNum(KEYS.reportesDone, n),
  docSeenTotal: (cia: string, code: string) => readNum(KEYS.docTotal(cia, code)),
  setDocSeenTotal: (cia: string, code: string, n: number) =>
    writeNum(KEYS.docTotal(cia, code), n),
}
