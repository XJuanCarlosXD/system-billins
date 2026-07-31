// Endpoints de Historial/Auditoría. Separado del core como reportes/asistente.
import { ApiError } from './api-client'

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init,
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) throw new ApiError(res.status, body)
  return body as T
}

export type CambioCampo = {
  campo: string
  etiqueta: string
  valor_anterior: string
  valor_nuevo: string
}

export type EventoHistorial = {
  bitacora_id: number
  fecha: string
  usuario: string
  modulo: string
  tipo_documento: string
  no_documento: string
  accion: 'CREAR' | 'EDITAR' | 'ANULAR' | 'REVERSAR'
  motivo: string | null
  descripcion: string
  cambios: CambioCampo[]
}

export function historialMio(limit = 10) {
  return request<{ items: EventoHistorial[] }>(`/historial/mio/?limit=${limit}`)
}

export function historialAdmin(params: {
  usuario?: string
  modulo?: string
  tipo_documento?: string
  no_documento?: string
  accion?: string
  fecha_desde?: string
  fecha_hasta?: string
  page?: number
  page_size?: number
}) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, String(v))
  })
  const qs = q.toString()
  return request<{ items: EventoHistorial[]; total: number }>(
    `/historial/${qs ? `?${qs}` : ''}`
  )
}

export function historialDocumento(params: {
  no_cia: string
  punto: string
  modulo: string
  tipo_documento: string
  no_documento: string
}) {
  const q = new URLSearchParams(params)
  return request<{ items: EventoHistorial[] }>(`/historial/documento/?${q.toString()}`)
}
