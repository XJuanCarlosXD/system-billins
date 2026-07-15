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
// CONV_ID en Oracle (TCHAT_CONVERSACION) es un uuid de texto, no numerico.
export type AsistenteConversacionResumen = {
  conv_id: string
  titulo: string
  model: string
  skill_activa: string | null
  no_cia: string
  punto: string
  fecha_creacion: string
  fecha_ultimo: string
  tokens_in_tot: number
  tokens_out_tot: number
  costo_usd: number
  archivada: string
}

export type AsistenteConversacionDetail = {
  conv_id: string
  usuario: string
  titulo: string
  model: string
  skill_activa: string | null
  no_cia: string
  punto: string
  fecha_creacion: string
  fecha_ultimo: string
  tokens_in_tot: number
  tokens_out_tot: number
  costo_usd: number
}

export type AsistenteConversacionNueva = {
  conv_id: string
  titulo: string
  model: string
}

export type AsistenteMensaje = {
  mensaje_id: number
  seq: number
  role: 'user' | 'assistant' | 'tool'
  contenido: string
  tool_calls: any | null
  tool_call_id: string | null
  tokens_in: number
  tokens_out: number
  fecha: string | null
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
export async function listConversaciones(): Promise<AsistenteConversacionResumen[]> {
  const res = await request<{ items: AsistenteConversacionResumen[] }>(
    '/asistente/conversaciones/'
  )
  return res.items
}

export async function createConversacion(data: { titulo?: string; model?: string }) {
  return request<AsistenteConversacionNueva>('/asistente/conversaciones/', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getConversacion(id: string) {
  return request<{
    conversacion: AsistenteConversacionDetail
    messages: AsistenteMensaje[]
  }>(`/asistente/conversaciones/${id}/`)
}

export async function deleteConversacion(id: string) {
  return request<void>(`/asistente/conversaciones/${id}/`, { method: 'DELETE' })
}

export async function patchConversacion(
  id: string,
  data: { titulo?: string; model?: string; skill_activa?: string | null },
) {
  return request<{ ok: boolean }>(`/asistente/conversaciones/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

// ---- Status ----
export type AsistenteStatus = {
  api_key_configurada: boolean
  modelo_default: string
}

export async function fetchAsistenteStatus(): Promise<AsistenteStatus> {
  return request<AsistenteStatus>('/asistente/status/')
}

// ---- Tools ----
export async function listTools(): Promise<AsistenteTool[]> {
  return request<AsistenteTool[]>('/asistente/tools/')
}

// ---- Skills ----
export type AsistenteSkillDetail = AsistenteSkill & {
  body: string
  frontmatter: Record<string, unknown>
}

export async function listSkills(): Promise<AsistenteSkill[]> {
  return request<AsistenteSkill[]>('/asistente/skills/')
}

export async function getSkill(name: string): Promise<AsistenteSkillDetail> {
  return request<AsistenteSkillDetail>(`/asistente/skills/${encodeURIComponent(name)}/`)
}

export async function createSkill(data: { name: string; body: string }) {
  return request<{ ok: boolean; name: string }>('/asistente/skills/', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateSkill(name: string, body: string) {
  return request<{ ok: boolean; name: string }>(
    `/asistente/skills/${encodeURIComponent(name)}/`,
    { method: 'PUT', body: JSON.stringify({ body }) },
  )
}

export async function deleteSkill(name: string) {
  return request<{ ok: boolean; name: string }>(
    `/asistente/skills/${encodeURIComponent(name)}/`,
    { method: 'DELETE' },
  )
}

// ---- Auditoria admin ----
export type AsistenteAuditoria = {
  by_user: { usuario: string; calls: number; errors: number; writes: number; avg_ms: number }[]
  by_tool: { tool_name: string; calls: number; errors: number; writes: number }[]
  by_day: { dia: string; calls: number; errors: number }[]
  totals: { calls: number; errors: number; writes: number; avg_ms: number }
}

export async function fetchAuditoria(
  params: { days?: number; no_cia?: string } = {},
): Promise<AsistenteAuditoria> {
  const search = new URLSearchParams()
  if (params.days != null) search.set('days', String(params.days))
  if (params.no_cia) search.set('no_cia', params.no_cia)
  const qs = search.toString()
  return request<AsistenteAuditoria>(
    `/admin/asistente/auditoria/${qs ? '?' + qs : ''}`,
  )
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
