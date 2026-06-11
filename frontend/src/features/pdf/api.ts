// Cliente API del subsistema PDFs.
// Reusa el mismo patrón fetch/credentials que sigaf-api.ts.

import type { Plantilla, PrintPayload } from './types'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init,
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(typeof body === 'string' ? body : JSON.stringify(body))
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
