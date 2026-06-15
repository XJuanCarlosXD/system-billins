// Cliente API del subsistema PDFs.
// Reusa el mismo patrón fetch/credentials que api-client.ts.

import type { Plantilla, PrintPayload } from './types'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init,
  })
  const text = await res.text()
  // Tolerar respuestas no-JSON (e.g. página HTML 500 cuando la tabla aún no existe).
  let body: any = null
  if (text) {
    try { body = JSON.parse(text) } catch {
      // No-JSON. Si fue 2xx con body raro lo logueamos; si fue error, usamos el status.
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} en ${path}`)
      body = null
    }
  }
  if (!res.ok) {
    const msg = typeof body === 'string' ? body
              : body && typeof body === 'object' ? JSON.stringify(body)
              : `HTTP ${res.status} ${res.statusText}`
    throw new Error(msg)
  }
  return body as T
}

// ── Print-data por documento ─────────────────────────────────────────────
export function fetchPrintData(path: string): Promise<PrintPayload> {
  return req<PrintPayload>(path)
}

// ── Plantillas ───────────────────────────────────────────────────────────
export function listPlantillas(no_cia: string): Promise<{ results: Plantilla[] }> {
  return req(`/settings/plantillas-pdf/?no_cia=${encodeURIComponent(no_cia)}`)
}

export function getPlantilla(no_cia: string, codigo_doc: string): Promise<Plantilla> {
  return req(`/settings/plantillas-pdf/${encodeURIComponent(codigo_doc)}/?no_cia=${encodeURIComponent(no_cia)}`)
}

export function savePlantilla(
  no_cia: string,
  codigo_doc: string,
  body: Partial<Plantilla> & { definicion_json: unknown; nombre: string },
): Promise<Plantilla> {
  return req(
    `/settings/plantillas-pdf/${encodeURIComponent(codigo_doc)}/?no_cia=${encodeURIComponent(no_cia)}`,
    { method: 'PUT', body: JSON.stringify(body) },
  )
}

export function restoreDefault(no_cia: string, codigo_doc: string): Promise<Plantilla> {
  return req(
    `/settings/plantillas-pdf/${encodeURIComponent(codigo_doc)}/?no_cia=${encodeURIComponent(no_cia)}`,
    { method: 'DELETE' },
  )
}

export function listHistorial(no_cia: string, codigo_doc: string) {
  return req(
    `/settings/plantillas-pdf/${encodeURIComponent(codigo_doc)}/historial/?no_cia=${encodeURIComponent(no_cia)}`,
  )
}

export function rollback(no_cia: string, codigo_doc: string, version: number) {
  return req(
    `/settings/plantillas-pdf/${encodeURIComponent(codigo_doc)}/rollback/?no_cia=${encodeURIComponent(no_cia)}&version=${version}`,
    { method: 'POST' },
  )
}
