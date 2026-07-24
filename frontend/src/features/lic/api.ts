// API del módulo de Licitaciones (portal externo) — /api/lic/*
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

// Nota: los parámetros de los hooks de abajo usan snake_case (`no_cia`) en vez del
// camelCase de `fe/api.ts` (`noCia`) -- deliberado: `no_cia` se pasa tal cual dentro de
// `JSON.stringify({ no_cia })` como cuerpo de la request, así que mantener el mismo
// nombre evita el mapeo camelCase↔snake_case en cada payload. Se documenta acá en vez de
// renombrar porque no hay consumidores todavía (Tasks 12-14).

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
  resumen_ia: string | null
  estado_cumplimiento: 'verde' | 'amarillo' | 'rojo' | null
  recomendacion_ia: string | null
  unidad_requisicion: string | null
  presupuesto_estimado: string | null
}

export interface TipoDocumento {
  id: number
  codigo: string
  nombre: string
  activo: 'S' | 'N'
}

export interface DocumentoEmpresa {
  id: number
  no_cia: string
  punto: string | null
  nombre_archivo: string
  ruta_archivo: string
  descripcion: string | null
  fecha_vencimiento: string | null
  tipo_documento_id: number | null
  tipo_documento_nombre: string | null
  vencido: 0 | 1
  subido_en: string
}

export interface Requisito {
  id: number
  descripcion: string
  estado: 'cumple' | 'parcial' | 'no_cumple' | 'sin_evaluar'
  justificacion: string | null
  documento_empresa_id: number | null
  actualizado_en: string
}

export interface AnalisisOportunidad {
  resumen: string
  recomendacion: string | null
  estado_cumplimiento: 'verde' | 'amarillo' | 'rojo'
  requisitos: Requisito[]
}

export interface Documento {
  id: number
  tipo_documento: string | null
  nombre_archivo: string
  ruta_archivo: string
  estado: 'ok' | 'error'
  mensaje_error: string | null
  resumen_ia: string | null
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

// Unión discriminada por `estado`: `ScrapeJob.resumen` (JSONField(default=dict)) solo se
// asigna una vez, al final de `ejecutar_scrape` cuando termina con éxito (estado
// completado/completado_con_errores). Los caminos que marcan estado="error" -- el wrapper
// de hilo en views.py y el except del comando de cron -- fijan `estado` pero nunca tocan
// `resumen`, que se queda en `{}` (el default del modelo). Mientras el job sigue
// "corriendo" tampoco hay resumen todavía. Tiparlo como `ScrapeResumen` siempre habría
// dejado pasar `data.resumen.errores` sin marcar error de tipos y reventado en runtime
// (`TypeError: Cannot read properties of undefined`) apenas la UI de polling (Task 13)
// leyera un job corriendo o fallado.
export type ScrapeJobStatus =
  | {
      id: number
      estado: 'corriendo' | 'error'
      iniciado_en: string
      terminado_en: string | null
      resumen: Record<string, never>
    }
  | {
      id: number
      estado: 'completado' | 'completado_con_errores'
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

// A diferencia de `fe/api.ts` (donde `useProbarConexion(noCia)` fija la empresa al
// instanciar el hook), aquí `no_cia` viaja por llamada -- útil porque esta pantalla lista
// credenciales de varias empresas a la vez y "probar" cualquier fila reusa el mismo hook.
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

export function useOportunidades(
  no_cia: string,
  estado?: string,
  todas?: boolean
) {
  return useQuery({
    queryKey: ['lic-oportunidades', no_cia, estado, todas],
    queryFn: () =>
      licRequest<{ oportunidades: Oportunidad[] }>(
        `/lic/oportunidades/?no_cia=${encodeURIComponent(no_cia)}${
          estado ? `&estado=${encodeURIComponent(estado)}` : ''
        }${todas ? '&todas=1' : ''}`
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

export function useGenerarResumenDocumento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (documentoId: number) =>
      licRequest<{ resumen_ia: string }>(
        `/lic/documentos/${documentoId}/resumen/`,
        { method: 'POST' }
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['lic-documentos'] }),
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

export function useDocumentosEmpresa(no_cia: string) {
  return useQuery({
    queryKey: ['lic-documentos-empresa', no_cia],
    queryFn: () =>
      licRequest<{ documentos: DocumentoEmpresa[] }>(
        `/lic/documentos-empresa/?no_cia=${encodeURIComponent(no_cia)}`
      ),
    enabled: !!no_cia,
  })
}

export function useSubirDocumentoEmpresa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      no_cia: string
      punto?: string
      archivo: File
      descripcion?: string
      fecha_vencimiento?: string
      tipo_documento_id?: number
    }) => {
      const form = new FormData()
      form.append('no_cia', payload.no_cia)
      if (payload.punto) form.append('punto', payload.punto)
      form.append('archivo', payload.archivo)
      if (payload.descripcion) form.append('descripcion', payload.descripcion)
      if (payload.fecha_vencimiento)
        form.append('fecha_vencimiento', payload.fecha_vencimiento)
      if (payload.tipo_documento_id)
        form.append('tipo_documento_id', String(payload.tipo_documento_id))
      return licRequest<{ documentos: DocumentoEmpresa[] }>(
        '/lic/documentos-empresa/',
        { method: 'POST', body: form }
      )
    },
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: ['lic-documentos-empresa', variables.no_cia] }),
  })
}

export function useTiposDocumento() {
  return useQuery({
    queryKey: ['lic-tipos-documento'],
    queryFn: () => licRequest<{ tipos: TipoDocumento[] }>('/lic/tipos-documento/'),
  })
}

export function useCrearTipoDocumento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { codigo: string; nombre: string }) =>
      licRequest<{ tipo: TipoDocumento }>('/lic/tipos-documento/', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lic-tipos-documento'] }),
  })
}

export function useActualizarTipoDocumento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { id: number; nombre?: string; activo?: 'S' | 'N' }) =>
      licRequest<{ tipos: TipoDocumento[] }>(`/lic/tipos-documento/${payload.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lic-tipos-documento'] }),
  })
}

export function documentoEmpresaDescargarUrl(documentoEmpresaId: number): string {
  return `${API_BASE}/lic/documentos-empresa/${documentoEmpresaId}/descargar/`
}

export function useAnalizarOportunidad() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (oportunidadId: number) =>
      licRequest<AnalisisOportunidad>(
        `/lic/oportunidades/${oportunidadId}/analizar/`,
        { method: 'POST' }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lic-oportunidades'] }),
  })
}

export function useRequisitos(oportunidadId: number | null) {
  return useQuery({
    queryKey: ['lic-requisitos', oportunidadId],
    queryFn: () =>
      licRequest<{ requisitos: Requisito[] }>(
        `/lic/oportunidades/${oportunidadId}/requisitos/`
      ),
    enabled: !!oportunidadId,
  })
}
