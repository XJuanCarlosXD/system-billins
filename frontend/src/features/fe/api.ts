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

// ---------------------------------------------------------------------------
// Bitácora de documentos enviados (TFE_DOCUMENTO) — Fase 2, Task 4
// ---------------------------------------------------------------------------

export interface FeDocumento {
  no_cia: string
  e_ncf: string
  tipo_ecf: string
  punto: string | null
  tipo_docu: string | null
  no_docu: string | null
  rnc_comprador: string | null
  monto_total: number | null
  estado: string
  track_id: string | null
  codigo_seguridad: string | null
  es_prueba: 'S' | 'N'
  intentos: number
  fecha_firma: string | null
  fecha_crea: string | null
  fecha_actualiza: string | null
}

export interface FeDocumentoDetalle extends FeDocumento {
  xml_firmado: string | null
  respuesta_dgii: string | null
}

export interface FeDocumentosFiltros {
  estado?: string
  tipo_ecf?: string
  es_prueba?: string
  limit?: number
  offset?: number
}

// Clave de ESTADOS_DOCUMENTO usada para decidir si el botón "Reenviar" se
// muestra (fe-documentos.tsx) -- exportada como constante en vez de
// repetir el literal 'RECHAZADO' en cada sitio que lo compara.
export const ESTADO_RECHAZADO = 'RECHAZADO'

export const ESTADOS_DOCUMENTO: Record<string, string> = {
  ENVIADO: 'Enviado',
  ACEPTADO: 'Aceptado',
  'ACEPTADO CONDICIONAL': 'Aceptado condicional',
  [ESTADO_RECHAZADO]: 'Rechazado',
  'EN PROCESO': 'En proceso',
  'NO ENCONTRADO': 'No encontrado',
  DESCONOCIDO: 'Desconocido',
}

export function useFeDocumentos(noCia: string, filtros: FeDocumentosFiltros = {}) {
  return useQuery({
    queryKey: ['fe-documentos', noCia, filtros],
    queryFn: () => {
      const params = new URLSearchParams({ no_cia: noCia })
      if (filtros.estado) params.set('estado', filtros.estado)
      if (filtros.tipo_ecf) params.set('tipo_ecf', filtros.tipo_ecf)
      if (filtros.es_prueba) params.set('es_prueba', filtros.es_prueba)
      params.set('limit', String(filtros.limit ?? 50))
      params.set('offset', String(filtros.offset ?? 0))
      return feRequest<{ items: FeDocumento[] }>(`/fe/documentos/?${params.toString()}`)
    },
    enabled: !!noCia,
    placeholderData: (prev) => prev,
  })
}

export function useFeDocumento(noCia: string, eNcf: string | null) {
  return useQuery({
    queryKey: ['fe-documento', noCia, eNcf],
    queryFn: () =>
      feRequest<{ documento: FeDocumentoDetalle }>(
        `/fe/documentos/${encodeURIComponent(eNcf as string)}/?no_cia=${encodeURIComponent(noCia)}`
      ),
    enabled: !!noCia && !!eNcf,
  })
}

export function useConsultarEstado(noCia: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (eNcf: string) =>
      feRequest<{ estado: string; respuesta_dgii: unknown }>(
        `/fe/documentos/${encodeURIComponent(eNcf)}/consultar-estado/`,
        { method: 'POST', body: JSON.stringify({ no_cia: noCia }) }
      ),
    onSuccess: (_data, eNcf) => {
      qc.invalidateQueries({ queryKey: ['fe-documentos', noCia] })
      qc.invalidateQueries({ queryKey: ['fe-documento', noCia, eNcf] })
    },
  })
}

export function useReenviarDocumento(noCia: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (eNcf: string) =>
      feRequest<{ trackId: string; respuesta_dgii: unknown }>(
        `/fe/documentos/${encodeURIComponent(eNcf)}/reenviar/`,
        { method: 'POST', body: JSON.stringify({ no_cia: noCia }) }
      ),
    onSuccess: (_data, eNcf) => {
      qc.invalidateQueries({ queryKey: ['fe-documentos', noCia] })
      qc.invalidateQueries({ queryKey: ['fe-documento', noCia, eNcf] })
    },
  })
}

// ---------------------------------------------------------------------------
// Modo Test — Set de Pruebas DGII (Fase 2, Task 5 — el backend de este
// endpoint aún no existe; esta pantalla lo llama igual (contrato ya
// documentado) y mostrará el 404 tal cual hasta que Task 5 lo implemente.
// ---------------------------------------------------------------------------

export interface EnviarPruebaInput {
  tipo_ecf: number
  encf: string
  datos: Record<string, unknown>
}

export function useEnviarPrueba(noCia: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: EnviarPruebaInput) =>
      feRequest<{ trackId?: string; respuesta_dgii?: unknown }>(
        `/fe/pruebas/enviar/`,
        { method: 'POST', body: JSON.stringify({ no_cia: noCia, ...input }) }
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['fe-documentos', noCia] }),
  })
}
