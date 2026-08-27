// Registro automático + reporte manual de errores. Reusa el módulo de
// Reportes/Soporte ya existente (apps/reportes) — no crea un sistema nuevo.
import { ApiError } from './api-client'
import { createReporte, fileToBase64 } from './api-client-reportes'

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

function currentModulo(): string {
  const seg = window.location.pathname.split('/').filter(Boolean)[0] || ''
  const known = ['fat', 'cxc', 'cxp', 'inv', 'cnt', 'acc', 'acf', 'chc', 'sdn', 'odc', 'man', 'fe']
  return known.includes(seg) ? seg.toUpperCase() : 'OTRO'
}

// Errores puros de red del navegador (sin status HTTP): fetch abortado por
// navegacion, wifi cortado un instante, backend reiniciando, offline. No hay
// bug que arreglar y crean ruido en TREP_PROBLEMA.
function esErrorRedTransitorio(mensaje: string, statusHttp?: number | null): boolean {
  if (statusHttp !== undefined && statusHttp !== null) return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const m = (mensaje || '').toLowerCase()
  return (
    m.includes('failed to fetch') ||
    m.includes('load failed') ||
    m.includes('networkerror') ||
    m.includes('network request failed')
  )
}

// Respuestas de politica de autenticacion/autorizacion. 401 = sesion expirada
// (el queryCache ya redirige a /sign-in), 403 = el usuario no tiene permiso
// para ese modulo/compania/punto. Ninguna es un bug: son la respuesta correcta
// del backend y no debe abrirse un TREP_PROBLEMA por ellas.
function esRespuestaPoliticaAuth(statusHttp?: number | null): boolean {
  return statusHttp === 401 || statusHttp === 403
}

/** Fire-and-forget: nunca lanza, nunca bloquea al caller. */
export async function logErrorAutomatico(mensaje: string, opts?: {
  statusHttp?: number
  detalle?: string
}): Promise<number | null> {
  if (esErrorRedTransitorio(mensaje, opts?.statusHttp)) return null
  if (esRespuestaPoliticaAuth(opts?.statusHttp)) return null
  try {
    const res = await fetch(`${API_BASE}/reportes/error-log/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mensaje: mensaje.slice(0, 1000),
        url: window.location.pathname,
        status_http: opts?.statusHttp ?? null,
        modulo: currentModulo(),
        detalle: opts?.detalle,
      }),
    })
    if (!res.ok) return null
    const body = await res.json()
    return body.error_id ?? null
  } catch {
    return null
  }
}

export function mensajeDeError(error: unknown): { mensaje: string; statusHttp?: number; detalle?: string } {
  if (error instanceof ApiError) {
    const detail = typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail)
    return { mensaje: detail || `Error ${error.status}`, statusHttp: error.status, detalle: detail }
  }
  if (error instanceof Error) {
    return { mensaje: error.message, detalle: error.stack }
  }
  return { mensaje: String(error) }
}

/** Captura un screenshot del viewport y crea un reporte pre-llenado. */
export async function reportarErrorConCaptura(
  mensaje: string,
  detalle?: string,
): Promise<string> {
  const html2canvas = (await import('html2canvas')).default
  let imagenes: { nombre: string; media_type: string; data: string }[] = []
  try {
    const canvas = await html2canvas(document.body, { logging: false })
    const dataUrl = canvas.toDataURL('image/png')
    const blob = await (await fetch(dataUrl)).blob()
    const file = new File([blob], 'captura.png', { type: 'image/png' })
    imagenes = [{ nombre: 'captura.png', media_type: 'image/png', data: await fileToBase64(file) }]
  } catch {
    // Si el screenshot falla (canvas tainted, etc.), reportar igual sin imagen.
    imagenes = []
  }
  const { reporte_id } = await createReporte({
    titulo: `Error automático: ${mensaje.slice(0, 150)}`,
    modulo: currentModulo(),
    descripcion: `${mensaje}\n\nURL: ${window.location.href}\n\n${detalle || ''}`.slice(0, 4000),
    imagenes,
  })
  return reporte_id
}
