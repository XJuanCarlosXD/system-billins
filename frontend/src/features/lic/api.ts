// API del módulo de Licitaciones (portal externo) — /api/lic/*
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

/** Error de la API de LIC. Cuando el backend adjunta `job_id` (409 de scrape_view,
 * guardia de concurrencia) queda disponible aquí para que el llamador decida qué
 * hacer (ej. redirigir al estado del job en curso) sin tener que reparsear el mensaje. */
export class LicApiError extends Error {
  job_id?: number
  constructor(message: string, job_id?: number) {
    super(message)
    this.name = 'LicApiError'
    this.job_id = job_id
  }
}

async function licRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
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
    // Las vistas de apps.lic devuelven {"error": "..."} (helper `_err`), a diferencia
    // de apps.fe que usa detail/mensaje — se prueban las tres claves por si acaso.
    const msg =
      body?.error || body?.detail || body?.mensaje || `Error ${res.status} del servidor`
    throw new LicApiError(msg, body?.job_id)
  }
  return body as T
}

export interface Credencial {
  no_cia: string
  usuario_portal: string
  estado: 'activo' | 'error_login'
  ultimo_login_ok: string | null
  ultimo_error: string | null
}

export interface Oportunidad {
  id: number
  referencia: string
  tipo_proceso: string | null
  entidad: string | null
  titulo: string | null
  estado_portal: string | null
  ofertas_presentadas: number
  ofertas_creadas: number
  fecha_publicacion: string | null
  fecha_limite: string | null
}

export interface Documento {
  tipo_documento: string | null
  nombre_archivo: string
  ruta_archivo: string
  estado: 'ok' | 'error'
  mensaje_error: string | null
  descargado_en: string
}

export interface Rubro {
  codigo: string | null
  descripcion: string
}

/** Un error individual dentro de `ScrapeJobStatus.resumen.errores` (Task 7:
 * `_agregar_error` en apps/lic/services/orchestrator.py). */
export interface ScrapeError {
  no_cia: string
  referencia: string | null
  contexto: string
  mensaje: string
}

export interface ScrapeResumen {
  oportunidades_nuevas: number
  documentos_descargados: number
  empresas_procesadas: string[]
  errores: ScrapeError[]
}

export interface ScrapeJobStatus {
  id: number
  estado: 'corriendo' | 'completado' | 'completado_con_errores' | 'error'
  iniciado_en: string
  terminado_en: string | null
  resumen: ScrapeResumen
}

export function useCredenciales() {
  return useQuery({
    queryKey: ['lic-credenciales'],
    queryFn: () => licRequest<{ credenciales: Credencial[] }>('/lic/credenciales/'),
  })
}

export function useGuardarCredencial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { no_cia: string; usuario_portal: string; password: string }) =>
      licRequest<{ credencial: Credencial }>('/lic/credenciales/', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lic-credenciales'] }),
  })
}

export function useProbarConexion() {
  return useMutation({
    mutationFn: (no_cia: string) =>
      licRequest<{ ok: boolean }>('/lic/credenciales/probar-conexion/', {
        method: 'POST',
        body: JSON.stringify({ no_cia }),
      }),
  })
}

export function useRubros(no_cia: string) {
  return useQuery({
    queryKey: ['lic-rubros', no_cia],
    queryFn: () =>
      licRequest<{ rubros: Rubro[] }>(
        `/lic/rubros-pdf/?no_cia=${encodeURIComponent(no_cia)}`
      ),
    enabled: !!no_cia,
  })
}

export function useSubirRubrosPdf() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { no_cia: string; archivo: File }) => {
      const form = new FormData()
      form.append('no_cia', payload.no_cia)
      form.append('archivo', payload.archivo)
      return licRequest<{ rubros: Rubro[] }>('/lic/rubros-pdf/', {
        method: 'POST',
        body: form,
      })
    },
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: ['lic-rubros', variables.no_cia] }),
  })
}

export function useOportunidades(no_cia: string, estado?: string) {
  return useQuery({
    queryKey: ['lic-oportunidades', no_cia, estado],
    queryFn: () =>
      licRequest<{ oportunidades: Oportunidad[] }>(
        `/lic/oportunidades/?no_cia=${encodeURIComponent(no_cia)}${
          estado ? `&estado=${encodeURIComponent(estado)}` : ''
        }`
      ),
    enabled: !!no_cia,
  })
}

export function useDocumentos(oportunidadId: number | null) {
  return useQuery({
    queryKey: ['lic-documentos', oportunidadId],
    queryFn: () =>
      licRequest<{ documentos: Documento[] }>(
        `/lic/oportunidades/${oportunidadId}/documentos/`
      ),
    enabled: !!oportunidadId,
  })
}

export function useBuscarAhora() {
  return useMutation({
    mutationFn: (no_cia?: string) =>
      licRequest<{ job_id: number }>('/lic/scrape/', {
        method: 'POST',
        body: JSON.stringify({ no_cia }),
      }),
  })
}

export function useScrapeJobStatus(jobId: number | null) {
  return useQuery({
    queryKey: ['lic-scrape-job', jobId],
    queryFn: () => licRequest<ScrapeJobStatus>(`/lic/scrape/${jobId}/`),
    enabled: !!jobId,
    refetchInterval: (query) =>
      query.state.data?.estado === 'corriendo' ? 2000 : false,
  })
}
