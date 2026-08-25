// Endpoints de Reportes de problemas ("Soporte"). Separado del core para no inflarlo.
import { ApiError, parseJsonOrThrow } from './api-client'

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init,
  })
  const text = await res.text()
  const body = parseJsonOrThrow(text, res.status)
  if (!res.ok) throw new ApiError(res.status, body)
  return body as T
}

export const MODULOS_REPORTE = [
  { value: 'FAT', label: 'Facturación (FAT)' },
  { value: 'INV', label: 'Inventario (INV)' },
  { value: 'CXC', label: 'Cuentas por Cobrar (CxC)' },
  { value: 'CXP', label: 'Cuentas por Pagar (CxP)' },
  { value: 'CNT', label: 'Contabilidad (CNT)' },
  { value: 'ACC', label: 'Caja Chica (ACC)' },
  { value: 'ACF', label: 'Activos Fijos (ACF)' },
  { value: 'CHC', label: 'Bancos / Cheques (CHC)' },
  { value: 'SDN', label: 'Nómina (SDN)' },
  { value: 'ODC', label: 'Órdenes de Compra (ODC)' },
  { value: 'MAN', label: 'Manuales (MAN)' },
  { value: 'FE', label: 'Facturación Electrónica (FE)' },
  { value: 'ASISTENTE', label: 'Asistente' },
  { value: 'OTRO', label: 'Otro' },
] as const

export type EstadoReporte = 'ABIERTO' | 'EN_PROGRESO' | 'HOLD' | 'COMPLETADO' | 'CANCELADO'

export type ReporteResumen = {
  reporte_id: string
  usuario: string
  modulo: string
  titulo: string
  estado: EstadoReporte
  fecha_creacion: string
  fecha_actualizacion: string
  fecha_resolucion: string | null
  resuelto_por: string | null
  num_imagenes: number
}

export type ReporteImagenMeta = {
  imagen_id: string
  nombre_archivo: string
  media_type: string
  tamano_bytes: number
}

export type ReporteDetail = ReporteResumen & {
  descripcion: string
  nota_resolucion: string | null
  imagenes: ReporteImagenMeta[]
}

export type NuevaImagenReporte = {
  nombre: string
  media_type: string
  data: string // base64 sin el prefijo data:
}

export function listReportes(params: {
  mine?: boolean
  estado?: string
  modulo?: string
}) {
  const q = new URLSearchParams()
  if (params.mine) q.set('mine', '1')
  if (params.estado) q.set('estado', params.estado)
  if (params.modulo) q.set('modulo', params.modulo)
  const qs = q.toString()
  return request<{ items: ReporteResumen[] }>(`/reportes/${qs ? `?${qs}` : ''}`)
}

export function getReporte(reporteId: string) {
  return request<ReporteDetail>(`/reportes/${reporteId}/`)
}

export function createReporte(body: {
  titulo: string
  modulo: string
  descripcion: string
  imagenes: NuevaImagenReporte[]
}) {
  return request<{ reporte_id: string; estado: EstadoReporte }>('/reportes/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function patchReporte(
  reporteId: string,
  body: { estado: EstadoReporte; nota_resolucion?: string }
) {
  return request<{ reporte_id: string; estado: EstadoReporte }>(
    `/reportes/${reporteId}/`,
    { method: 'PATCH', body: JSON.stringify(body) }
  )
}

export function imagenReporteUrl(reporteId: string, imagenId: string) {
  return `${API_BASE}/reportes/${reporteId}/imagen/${imagenId}/`
}

export async function fileToBase64(file: File): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('read_error'))
    r.readAsDataURL(file)
  })
  return dataUrl.split(',')[1] || ''
}
