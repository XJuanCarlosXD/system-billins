// Endpoints del asistente. Separado de api-client.ts para evitar inflar el core.
import { ApiError } from './api-client'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

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

// ---- DTOs ----
export type AsistenteConversacion = {
  id: number
  titulo: string
  modelo: string
  modulo_activo: string | null
  skill_activa: string | null
  total_input_tokens: number
  total_output_tokens: number
  total_cache_read_tokens: number
  costo_estimado_usd: number
  ts_creado: string
  ts_actualizado: string
}

export type AsistenteMensaje = {
  id: number
  conv_id: number
  role: 'user' | 'assistant' | 'tool'
  content: string
  tool_name: string | null
  tool_call_id: string | null
  tool_args: any | null
  tool_result: any | null
  input_tokens: number
  output_tokens: number
  ts_creado: string
}

export type AsistenteTool = {
  name: string
  description: string
  modules_required: string[]
  is_write: boolean
}

export type AsistenteSkill = {
  name: string
  description: string
  modules_required: string[]
  tools_used: string[]
}

// ---- Conversaciones ----
export async function listConversaciones(): Promise<AsistenteConversacion[]> {
  return request<AsistenteConversacion[]>('/asistente/conversaciones/')
}

export async function createConversacion(data: { titulo?: string; modelo?: string }) {
  return request<AsistenteConversacion>('/asistente/conversaciones/', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getConversacion(id: number) {
  return request<AsistenteConversacion & { mensajes: AsistenteMensaje[] }>(
    `/asistente/conversaciones/${id}/`
  )
}

export async function deleteConversacion(id: number) {
  return request<void>(`/asistente/conversaciones/${id}/`, { method: 'DELETE' })
}

// ---- Tools ----
export async function listTools(): Promise<AsistenteTool[]> {
  return request<AsistenteTool[]>('/asistente/tools/')
}

// ---- Skills ----
export async function listSkills(): Promise<AsistenteSkill[]> {
  return request<AsistenteSkill[]>('/asistente/skills/')
}

// ---- Confirm ----
export async function confirmTool(sig: string, approved: boolean) {
  return request<{ ok: boolean }>(`/asistente/confirm/${sig}/`, {
    method: 'POST',
    body: JSON.stringify({ approved }),
  })
}

// Modelos disponibles (hardcoded; coincide con backend settings.ASISTENTE_MODELS).
export const ASISTENTE_MODELS = [
  { value: 'claude-opus-4-7', label: 'Opus 4.7' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
] as const
