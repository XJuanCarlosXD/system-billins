// API de Facturación Electrónica (e-CF DGII) — /api/fe/*
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

function readCsrfToken(): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith('csrftoken='))
  return match ? match.split('=')[1] : ''
}

async function feRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || 'GET').toUpperCase()
  const isForm = init.body instanceof FormData
  const headers: Record<string, string> = {
    ...(method !== 'GET' ? { 'X-CSRFToken': readCsrfToken() } : {}),
    ...(!isForm ? { 'Content-Type': 'application/json' } : {}),
    ...((init.headers as Record<string, string>) || {}),
  }
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers,
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) {
    const msg =
      body?.detail || body?.mensaje || `Error ${res.status} del servidor`
    throw new Error(msg)
  }
  return body as T
}

export interface FeConfig {
  no_cia: string
  ambiente: 'testecf' | 'certecf' | 'ecf'
  rnc_emisor: string
  razon_social: string
  nombre_comercial: string | null
  direccion_emisor: string | null
  municipio: string | null
  provincia: string | null
  cert_subject: string | null
  cert_vence: string | null
  estado_cert: string
  activo: 'S' | 'N'
  fecha_actualiza: string | null
  tiene_cert: 'S' | 'N'
}

export interface FeSecuencia {
  no_cia: string
  tipo_ecf: string
  secuencia_desde: number
  secuencia_hasta: number
  prox_secuencia: number
  fecha_vence: string
  activa: 'S' | 'N'
}

export const TIPOS_ECF: Record<string, string> = {
  '31': 'Factura de Crédito Fiscal Electrónica',
  '32': 'Factura de Consumo Electrónica',
  '33': 'Nota de Débito Electrónica',
  '34': 'Nota de Crédito Electrónica',
  '41': 'Compras Electrónico',
  '43': 'Gastos Menores Electrónico',
  '44': 'Regímenes Especiales Electrónica',
  '45': 'Gubernamental Electrónico',
  '46': 'Exportaciones Electrónico',
  '47': 'Pagos al Exterior Electrónico',
}

export const AMBIENTES_FE: Record<string, string> = {
  testecf: 'Pruebas (TesteCF)',
  certecf: 'Certificación (CerteCF)',
  ecf: 'Producción (eCF)',
}

export const ESTADOS_CERT: Record<string, string> = {
  NO_INICIADO: 'No iniciado',
  POSTULACION: 'Postulación enviada',
  PRUEBAS: 'Set de pruebas',
  SIMULACION: 'Simulación',
  CERTIFICADO: 'Certificado',
}

export function useFeConfig(noCia: string) {
  return useQuery({
    queryKey: ['fe-config', noCia],
    queryFn: () =>
      feRequest<{ config: FeConfig | null }>(
        `/fe/config/?no_cia=${encodeURIComponent(noCia)}`
      ),
    enabled: !!noCia,
  })
}

export function useSaveFeConfig(noCia: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<FeConfig>) =>
      feRequest<{ config: FeConfig }>(`/fe/config/`, {
        method: 'PUT',
        body: JSON.stringify({ no_cia: noCia, ...data }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fe-config', noCia] }),
  })
}

export function useUploadCertificado(noCia: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { file: File; password: string }) => {
      const fd = new FormData()
      fd.append('no_cia', noCia)
      fd.append('certificado', input.file)
      fd.append('password', input.password)
      return feRequest<{ cert_subject: string; cert_vence: string }>(
        `/fe/config/certificado/`,
        { method: 'POST', body: fd }
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fe-config', noCia] }),
  })
}

export function useProbarConexion(noCia: string) {
  return useMutation({
    mutationFn: () =>
      feRequest<{ ok: boolean; mensaje: string; ambiente?: string }>(
        `/fe/config/probar-conexion/`,
        { method: 'POST', body: JSON.stringify({ no_cia: noCia }) }
      ),
  })
}

export function useFeSecuencias(noCia: string) {
  return useQuery({
    queryKey: ['fe-secuencias', noCia],
    queryFn: () =>
      feRequest<{ items: FeSecuencia[] }>(
        `/fe/secuencias/?no_cia=${encodeURIComponent(noCia)}`
      ),
    enabled: !!noCia,
  })
}

export function useSaveFeSecuencia(noCia: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (s: Partial<FeSecuencia>) =>
      feRequest<{ items: FeSecuencia[] }>(`/fe/secuencias/`, {
        method: 'POST',
        body: JSON.stringify({ no_cia: noCia, ...s }),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['fe-secuencias', noCia] }),
  })
}
