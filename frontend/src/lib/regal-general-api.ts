const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'
export class ApiError extends Error {
  status: number
  detail: any
  constructor(status: number, detail: any) {
    super(typeof detail === 'string' ? detail : JSON.stringify(detail))
    this.status = status
    this.detail = detail
  }
}

function readCsrfToken(): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.split('; ').find(c => c.startsWith('csrftoken='))
  return match ? match.split('=')[1] : ''
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || 'GET').toUpperCase()
  const csrfHeader = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
    ? { 'X-CSRFToken': readCsrfToken() }
    : {}
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...csrfHeader, ...(init.headers || {}) },
    ...init,
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) throw new ApiError(res.status, body)
  return body as T
}

/**
 * Helper genérico para POST con CSRF token. Usado por componentes que hacen
 * fetch directo en vez de pasar por `request` (e.g., los procesos INV).
 */
export async function postJsonWithCsrf(url: string, payload: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': readCsrfToken() },
    body: JSON.stringify(payload),
  })
}

// ---- DTOs ----
export type Company = {
  no_cia: string
  descripcion: string
  rnc: string | null
  activa: boolean
}

export type ModuleAccess = {
  modulo: string
  no_cia: string
  punto: string
  activo: boolean
  por_defecto: boolean
}

export type Me = {
  username: string
  is_authenticated: boolean
  is_admin: boolean
  companies: Company[]
  modules: ModuleAccess[]
}

export type AdminUser = {
  username: string
  account_status: string
  lock_date: string | null
  expiry_date: string | null
  created: string
  profile?: string
}

export type ModulePermissions = {
  no_cia: string
  punto: string
  usuario: string
  modulo: string
  activo: boolean
  por_defecto: boolean
  flags: Record<string, boolean>
  extras: Record<string, any>
  document_perms: Array<{ tipo_docu: string; por_defecto: boolean } & Record<string, any>>
}

export type NCFRange = {
  no_cia: string
  punto: string
  codigo_ncf: string
  tipo_ncf_fiscal: string
  ncf_inicial: number
  ncf_final: number
  prox_ncf: number
  ncf_manual: boolean
  ncf_opcional: boolean
  cant_min_ncf: number
  disponibles: number
  low_stock: boolean
  critical: boolean
  posiciones_fijas?: string
  descripcion?: string
}

export type DocumentType = {
  no_cia: string
  tipo_docu: string
  descripcion: string
  tipo_transaccion: string
  activo: boolean
  codigo_ncf: string | null
}

export type DocumentTypeUpsert = {
  no_cia: string
  tipo_docu: string
  descripcion: string
  tipo_transaccion: string
  activo?: boolean
  codigo_ncf?: string | null
}

export type NCFAlert = {
  no_cia: string
  empresa: string | null
  rnc: string | null
  codigo_ncf: string
  ncf_inicial: number
  ncf_final: number
  prox_ncf: number
  disponibles: number
  cant_min_ncf: number
  low_stock: boolean
  critical: boolean
  severity: 'critical' | 'warning' | 'ok'
}

// ---- Endpoints ----
export const regalGeneralApi = {
  health: () => request<{ status: string }>('/health/'),
  oracleHealth: () => request<{ status: string; user?: string }>('/health/oracle/'),

  login: (username: string, password: string) =>
    request<{ username: string; is_authenticated: boolean }>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ detail: string }>('/auth/logout/', { method: 'POST' }),
  me: () => request<Me>('/me/'),
  myPermissions: (modulo: string, no_cia: string, punto: string) =>
    request<ModulePermissions>(
      `/me/permissions/?modulo=${modulo}&no_cia=${no_cia}&punto=${punto}`,
    ),
  meAccess: () =>
    request<{
      username: string
      is_admin: boolean
      companies: Array<{ no_cia: string; descripcion: string; puntos: string[] }>
      modules: Record<
        string,
        { no_cias: string[]; puntos: Record<string, string[]> }
      >
      flags: Record<string, string[]>
      tipos_docu: Record<string, string[]>
    }>('/me/access/'),

  fatNcf: (no_cia: string, punto: string) =>
    request<{
      no_cia: string
      punto: string
      usuario: string
      ncf_ranges: NCFRange[]
      document_types: DocumentType[]
    }>(`/fat/ncf/?no_cia=${no_cia}&punto=${punto}`),

  fatSaveNcfRange: (
    payload: {
      no_cia: string
      codigo_ncf: string
      tipo_ncf_fiscal: string
      ncf_inicial: number
      ncf_final: number
      prox_ncf?: number
      ncf_manual?: boolean
      ncf_opcional?: boolean
      cant_min_ncf?: number
    },
    method: 'POST' | 'PATCH' = 'POST',
  ) =>
    request<{ action: string; codigo_ncf: string }>(`/fat/ncf/`, {
      method,
      body: JSON.stringify(payload),
    }),

  fatSaveDocumentType: (
    payload: DocumentTypeUpsert,
    method: 'POST' | 'PATCH' = 'POST',
  ) =>
    request<{ action: string; tipo_docu: string }>(`/fat/documents/`, {
      method,
      body: JSON.stringify(payload),
    }),

  fatSearch: (
    no_cia: string,
    punto = '01',
    search = '',
    page = 1,
    pageSize = 25,
  ) =>
    request<{
      items: Array<{
        no_cia: string
        punto: string
        ncf: string
        fecha: string | null
        cliente: string
        monto: number
        estado: string
      }>
      total: number
      page: number
      page_size: number
      total_pages: number
    }>(`/fat/search/?no_cia=${no_cia}&punto=${punto}&search=${encodeURIComponent(search)}&page=${page}&page_size=${pageSize}`),

  fatNcfAlerts: (level: 'low' | 'critical' | 'all' = 'low') =>
    request<{ count: number; level: string; alerts: NCFAlert[] }>(
      `/fat/ncf/alerts/?level=${level}`,
    ),

  cntConfig: (no_cia: string) =>
    request<{ cia: Record<string, any>; puntos: Array<Record<string, any>> }>(
      `/cnt/config/?no_cia=${encodeURIComponent(no_cia)}`,
    ),

  cntCatalogo: (params: {
    search?: string
    tipo?: string
    clase?: string
    activa?: boolean
  } = {}) => {
    const qs = new URLSearchParams()
    if (params.search) qs.set('search', params.search)
    if (params.tipo) qs.set('tipo', params.tipo)
    if (params.clase) qs.set('clase', params.clase)
    if (params.activa !== undefined) qs.set('activa', params.activa ? '1' : '0')
    return request<Array<Record<string, any>>>(`/cnt/catalogo/?${qs.toString()}`)
  },

  cntGetCuenta: (cuenta: string) =>
    request<Record<string, any>>(`/cnt/catalogo/${encodeURIComponent(cuenta)}/`),

  cntCreateCuenta: (payload: Record<string, any>) =>
    request<{ ok: boolean }>('/cnt/catalogo/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  cntUpdateCuenta: (cuenta: string, payload: Record<string, any>) =>
    request<{ ok: boolean }>(`/cnt/catalogo/${encodeURIComponent(cuenta)}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  cntTcuenta: () =>
    request<Array<Record<string, any>>>('/cnt/tcuenta/'),

  cntTcuentaCreate: (payload: { tipo: string; descripcion: string; clase: string }) =>
    request<{ ok: boolean; tipo: string }>('/cnt/tcuenta/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  cntTcuentaUpdate: (tipo: string, payload: { descripcion?: string; clase?: string }) =>
    request<{ ok: boolean }>(`/cnt/tcuenta/${encodeURIComponent(tipo)}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  cntTcuentaDelete: (tipo: string) =>
    request<{ ok: boolean }>(`/cnt/tcuenta/${encodeURIComponent(tipo)}/`, {
      method: 'DELETE',
    }),

  cntCiaHeader: (no_cia: string) =>
    request<{ no_cia: string; descripcion: string; direccion1: string | null; direccion2: string | null; rnc: string | null; telefono1: string | null }>(
      `/cnt/cia-header/?no_cia=${encodeURIComponent(no_cia)}`,
    ),

  // Logo URL publica (sin auth) — usar con cache-buster opcional
  cntCiaLogoUrl: (no_cia: string, cacheBust?: string | number) => {
    const base = `${API_BASE}/cnt/cia-logo/${encodeURIComponent(no_cia)}/`
    return cacheBust ? `${base}?t=${encodeURIComponent(cacheBust)}` : base
  },

  // Subir logo de empresa (multipart). file debe ser PNG/JPG/JPEG/GIF/WEBP/SVG.
  cntUploadCiaLogo: async (no_cia: string, file: File) => {
    const form = new FormData()
    form.append('no_cia', no_cia)
    form.append('logo', file)
    const res = await fetch(`${API_BASE}/cnt/cia-header/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRFToken': readCsrfToken() },
      body: form,
    })
    const text = await res.text()
    const body = text ? JSON.parse(text) : null
    if (!res.ok) throw new ApiError(res.status, body)
    return body as { logo_url: string }
  },

  // Eliminar logo de empresa
  cntDeleteCiaLogo: (no_cia: string) =>
    request<{ ok: boolean }>(`/cnt/cia-header/`, {
      method: 'DELETE',
      body: JSON.stringify({ no_cia }),
    }),

  cntCentrosCosto: (no_cia: string) =>
    request<Array<Record<string, any>>>(`/cnt/centros-costo/?no_cia=${encodeURIComponent(no_cia)}`),

  cntCreateCentroCosto: (payload: Record<string, any>) =>
    request<Record<string, any>>('/cnt/centros-costo/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ─── INV · Almacenes (catálogo CRUD) ────────────────────────────────────────
  // PK Oracle = (no_cia, punto, almacen) en INV.TINV_ALMACEN.
  invAlmacenes: (no_cia: string, punto?: string) => {
    const qs = new URLSearchParams({ no_cia })
    if (punto) qs.set('punto', punto)
    return request<{ count: number; results: Array<Record<string, any>> }>(
      `/inv/almacenes/?${qs.toString()}`,
    )
  },

  invCreateAlmacen: (payload: {
    no_cia: string
    punto: string
    almacen: string
    descripcion: string
    tipo_almacen?: string
    cual_costo?: string
    activo?: string
  }) =>
    request<{ ok: boolean; no_cia: string; punto: string; almacen: string }>('/inv/almacenes/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  invUpdateAlmacen: (no_cia: string, punto: string, almacen: string, payload: Record<string, any>) =>
    request<{ ok: boolean }>(
      `/inv/almacenes/${encodeURIComponent(almacen)}/?no_cia=${encodeURIComponent(no_cia)}&punto=${encodeURIComponent(punto)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    ),

  invDeleteAlmacen: (no_cia: string, punto: string, almacen: string) =>
    request<{ ok: boolean }>(
      `/inv/almacenes/${encodeURIComponent(almacen)}/?no_cia=${encodeURIComponent(no_cia)}&punto=${encodeURIComponent(punto)}`,
      { method: 'DELETE' },
    ),

  // ---- INV catalogos (CRUD) ----
  // Companias (PK no_cia)
  invListCompanias: () =>
    request<{ count: number; results: Array<Record<string, any>> }>('/inv/companias/'),
  invCreateCompania: (payload: { no_cia: string; descripcion: string; activo?: string; registro_cont?: string }) =>
    request<{ ok: boolean; no_cia: string }>('/inv/companias/', { method: 'POST', body: JSON.stringify(payload) }),
  invUpdateCompania: (no_cia: string, payload: Record<string, any>) =>
    request<{ ok: boolean }>(`/inv/companias/${encodeURIComponent(no_cia)}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
  invDeleteCompania: (no_cia: string) =>
    request<{ ok: boolean }>(`/inv/companias/${encodeURIComponent(no_cia)}/`, { method: 'DELETE' }),

  // Grupos de productos (PK no_grupo)
  invListGrupos: (no_cia: string) =>
    request<{ count: number; results: Array<Record<string, any>> }>(`/inv/grupos/?no_cia=${encodeURIComponent(no_cia)}`),
  invCreateGrupo: (payload: { grupo_produ: string; descripcion: string }) =>
    request<{ ok: boolean; grupo_produ: string }>('/inv/grupos/', { method: 'POST', body: JSON.stringify(payload) }),
  invUpdateGrupo: (no_grupo: string, payload: Record<string, any>) =>
    request<{ ok: boolean }>(`/inv/grupos/${encodeURIComponent(no_grupo)}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
  invDeleteGrupo: (no_grupo: string) =>
    request<{ ok: boolean }>(`/inv/grupos/${encodeURIComponent(no_grupo)}/`, { method: 'DELETE' }),

  // Lineas de productos (PK linea)
  invListLineas: (no_cia: string) =>
    request<{ count: number; results: Array<Record<string, any>> }>(`/inv/lineas/?no_cia=${encodeURIComponent(no_cia)}`),
  invCreateLinea: (payload: { linea: string; descripcion: string }) =>
    request<{ ok: boolean; linea: string }>('/inv/lineas/', { method: 'POST', body: JSON.stringify(payload) }),
  invUpdateLinea: (linea: string, payload: Record<string, any>) =>
    request<{ ok: boolean }>(`/inv/lineas/${encodeURIComponent(linea)}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
  invDeleteLinea: (linea: string) =>
    request<{ ok: boolean }>(`/inv/lineas/${encodeURIComponent(linea)}/`, { method: 'DELETE' }),

  // Sub lineas (PK linea + sub_linea)
  invListSublineas: (no_cia: string, linea?: string) => {
    const qs = new URLSearchParams({ no_cia })
    if (linea) qs.set('linea', linea)
    return request<{ count: number; results: Array<Record<string, any>> }>(`/inv/sublineas/?${qs.toString()}`)
  },
  invCreateSublinea: (payload: { linea: string; sub_linea: string; descripcion: string; pct_comision?: number | null; pct_margen?: number | null }) =>
    request<{ ok: boolean; linea: string; sub_linea: string }>('/inv/sublineas/', { method: 'POST', body: JSON.stringify(payload) }),
  invUpdateSublinea: (linea: string, sub_linea: string, payload: Record<string, any>) =>
    request<{ ok: boolean }>(`/inv/sublineas/${encodeURIComponent(sub_linea)}/?linea=${encodeURIComponent(linea)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  invDeleteSublinea: (linea: string, sub_linea: string) =>
    request<{ ok: boolean }>(`/inv/sublineas/${encodeURIComponent(sub_linea)}/?linea=${encodeURIComponent(linea)}`, { method: 'DELETE' }),

  // Unidades de empaque (PK unidad)
  invListUnidades: () =>
    request<{ count: number; results: Array<Record<string, any>> }>('/inv/unidades/'),
  invCreateUnidad: (payload: { unidad: string; descripcion: string }) =>
    request<{ ok: boolean; unidad: string }>('/inv/unidades/', { method: 'POST', body: JSON.stringify(payload) }),
  invUpdateUnidad: (unidad: string, payload: Record<string, any>) =>
    request<{ ok: boolean }>(`/inv/unidades/${encodeURIComponent(unidad)}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
  invDeleteUnidad: (unidad: string) =>
    request<{ ok: boolean }>(`/inv/unidades/${encodeURIComponent(unidad)}/`, { method: 'DELETE' }),

  // Referencias de empaque (PK referencia)
  invListReferencias: () =>
    request<{ count: number; results: Array<Record<string, any>> }>('/inv/referencias-empaque/'),
  invCreateReferencia: (payload: { referencia: string; descripcion: string }) =>
    request<{ ok: boolean; referencia: string }>('/inv/referencias-empaque/', { method: 'POST', body: JSON.stringify(payload) }),
  invUpdateReferencia: (referencia: string, payload: Record<string, any>) =>
    request<{ ok: boolean }>(`/inv/referencias-empaque/${encodeURIComponent(referencia)}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
  invDeleteReferencia: (referencia: string) =>
    request<{ ok: boolean }>(`/inv/referencias-empaque/${encodeURIComponent(referencia)}/`, { method: 'DELETE' }),

  // Grupos contables (PK grupo_contable)
  invListGruposContables: () =>
    request<{ count: number; results: Array<Record<string, any>> }>('/inv/grupos-contables/'),
  invCreateGrupoContable: (payload: {
    grupo_contable: string
    descripcion: string
    inventario?: string | null
    ajuste_inventario?: string | null
    costo_venta_contado?: string | null
    costo_venta_credito?: string | null
    ingreso_venta_contado?: string | null
    ingreso_venta_credito?: string | null
  }) =>
    request<{ ok: boolean; grupo_contable: string }>('/inv/grupos-contables/', { method: 'POST', body: JSON.stringify(payload) }),
  invUpdateGrupoContable: (grupo_contable: string, payload: Record<string, any>) =>
    request<{ ok: boolean }>(`/inv/grupos-contables/${encodeURIComponent(grupo_contable)}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
  invDeleteGrupoContable: (grupo_contable: string) =>
    request<{ ok: boolean }>(`/inv/grupos-contables/${encodeURIComponent(grupo_contable)}/`, { method: 'DELETE' }),

  // Tipos de documentos (PK tipo_docu)
  invListTiposDocu: () =>
    request<{ count: number; results: Array<Record<string, any>> }>('/inv/tipos-docu/'),
  invCreateTipoDocu: (payload: {
    tipo_docu: string
    descripcion: string
    tipo_movi?: string
    tipo_transaccion?: string
    nc_obligatoria?: string
  }) =>
    request<{ ok: boolean; tipo_docu: string }>('/inv/tipos-docu/', { method: 'POST', body: JSON.stringify(payload) }),
  invUpdateTipoDocu: (tipo_docu: string, payload: Record<string, any>) =>
    request<{ ok: boolean }>(`/inv/tipos-docu/${encodeURIComponent(tipo_docu)}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
  invDeleteTipoDocu: (tipo_docu: string) =>
    request<{ ok: boolean }>(`/inv/tipos-docu/${encodeURIComponent(tipo_docu)}/`, { method: 'DELETE' }),

  cntPeriodos: (no_cia: string) =>
    request<{
      puntos: Array<Record<string, any>>
      cierres: Array<Record<string, any>>
      years: number[]
      rangos: Record<string, Record<string, any>>
    }>(
      `/cnt/periodos/?no_cia=${encodeURIComponent(no_cia)}`,
    ),

  cntCierres: (no_cia: string, punto: string) =>
    request<Array<Record<string, any>>>(
      `/cnt/cierres/?no_cia=${encodeURIComponent(no_cia)}&punto=${encodeURIComponent(punto)}`,
    ),

  cntNcf: (no_cia: string, punto: string) =>
    request<Array<Record<string, any>>>(
      `/cnt/ncf/?no_cia=${encodeURIComponent(no_cia)}&punto=${encodeURIComponent(punto)}`,
    ),

  cntCreateNcf: (payload: Record<string, any>) =>
    request<Record<string, any>>('/cnt/ncf/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  cntUpdateNcf: (codigo_ncf: string, payload: Record<string, any>) =>
    request<{ ok: boolean }>(`/cnt/ncf/${encodeURIComponent(codigo_ncf)}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  cntAsientos: (
    no_cia: string,
    punto: string,
    ano: number,
    mes: number,
    params: {
      page?: number
      pageSize?: number
      search?: string
      autorizado?: boolean
      actualizado?: boolean
      anulado?: boolean
    } = {},
  ) => {
    const qs = new URLSearchParams({
      no_cia,
      punto,
      ano: String(ano),
      mes: String(mes),
      page: String(params.page ?? 1),
      page_size: String(params.pageSize ?? 50),
    })
    if (params.search) qs.set('search', params.search)
    if (params.autorizado !== undefined) qs.set('autorizado', params.autorizado ? '1' : '0')
    if (params.actualizado !== undefined) qs.set('actualizado', params.actualizado ? '1' : '0')
    if (params.anulado !== undefined) qs.set('anulado', params.anulado ? '1' : '0')
    return request<{
      items: Array<Record<string, any>>
      total: number
      page: number
      page_size: number
    }>(`/cnt/asientos/?${qs.toString()}`)
  },

  cntGetAsiento: (no_cia: string, punto: string, ano: number, mes: number, no_asiento: number) =>
    request<Record<string, any>>(
      `/cnt/asientos/${no_asiento}/?no_cia=${encodeURIComponent(no_cia)}&punto=${encodeURIComponent(punto)}&ano=${ano}&mes=${mes}`,
    ),

  cntCreateAsiento: (payload: Record<string, any>) =>
    request<{ no_asiento: number }>('/cnt/asientos/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  cntAprobar: (no_asiento: number, payload: Record<string, any>) =>
    request<{ ok: boolean }>(`/cnt/asientos/${no_asiento}/aprobar/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  cntActualizar: (no_asiento: number, payload: Record<string, any>) =>
    request<{ ok: boolean }>(`/cnt/asientos/${no_asiento}/actualizar/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  cntAnular: (no_asiento: number, payload: Record<string, any>) =>
    request<{ ok: boolean }>(`/cnt/asientos/${no_asiento}/anular/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  cntBalance: (no_cia: string, punto: string, ano: number, mes: number) =>
    request<Array<Record<string, any>>>(
      `/cnt/balance/?no_cia=${encodeURIComponent(no_cia)}&punto=${encodeURIComponent(punto)}&ano=${ano}&mes=${mes}`,
    ),

  cntMayor: (
    no_cia: string,
    punto: string,
    cuenta: string,
    ano: number,
    mes_ini: number,
    mes_fin: number,
  ) =>
    request<{ cuenta: Record<string, any>; movimientos: Array<Record<string, any>> }>(
      `/cnt/mayor/?no_cia=${encodeURIComponent(no_cia)}&punto=${encodeURIComponent(punto)}&cuenta=${encodeURIComponent(cuenta)}&ano=${ano}&mes_ini=${mes_ini}&mes_fin=${mes_fin}`,
    ),

  cntPresupuesto: (no_cia: string, punto: string, ano: number) =>
    request<Array<Record<string, any>>>(
      `/cnt/presupuesto/?no_cia=${encodeURIComponent(no_cia)}&punto=${encodeURIComponent(punto)}&ano=${ano}`,
    ),

  cntUpsertPresupuesto: (payload: Record<string, any>) =>
    request<{ ok: boolean }>('/cnt/presupuesto/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  cntEstadoResultados: (
    no_cia: string,
    punto: string,
    ano: number,
    mes_ini: number,
    mes_fin: number,
  ) =>
    request<Record<string, any>>(
      `/cnt/estado-resultados/?no_cia=${encodeURIComponent(no_cia)}&punto=${encodeURIComponent(punto)}&ano=${ano}&mes_ini=${mes_ini}&mes_fin=${mes_fin}`,
    ),

  changeOwnPassword: (current: string, newPwd: string, confirm: string) =>
    request<{ detail: string }>('/auth/change-password/', {
      method: 'POST',
      body: JSON.stringify({
        current_password: current,
        new_password: newPwd,
        confirm_password: confirm,
      }),
    }),

  adminListUsers: (params: {
    q?: string
    includeLocked?: boolean
    page?: number
    pageSize?: number
    orderBy?: 'username' | 'created' | 'status'
    direction?: 'asc' | 'desc'
  } = {}) => {
    const qs = new URLSearchParams()
    if (params.q) qs.set('q', params.q)
    qs.set('include_locked', params.includeLocked === false ? '0' : '1')
    qs.set('page', String(params.page ?? 1))
    qs.set('page_size', String(params.pageSize ?? 25))
    qs.set('order_by', params.orderBy ?? 'created')
    qs.set('direction', params.direction ?? 'desc')
    return request<{
      items: AdminUser[]
      total: number
      page: number
      page_size: number
      total_pages: number
      order_by: string
      direction: string
      // compat
      users: AdminUser[]
      count: number
    }>(`/admin/users/?${qs.toString()}`)
  },

  adminCreateUser: (username: string, password: string) =>
    request<{ username: string; created: boolean }>('/admin/users/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  adminGetUser: (username: string) =>
    request<AdminUser>(`/admin/users/${encodeURIComponent(username)}/`),

  adminUpdateUser: (
    username: string,
    payload: { new_password?: string; locked?: boolean },
  ) =>
    request<AdminUser>(`/admin/users/${encodeURIComponent(username)}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  adminListUserAccess: (username: string) =>
    request<{ username: string; access: ModuleAccess[] }>(
      `/admin/users/${encodeURIComponent(username)}/access/`,
    ),

  adminGrantAccess: (
    username: string,
    payload: { modulo: string; no_cia: string; punto?: string; activo?: boolean; por_defecto?: boolean },
  ) =>
    request<any>(`/admin/users/${encodeURIComponent(username)}/access/`, {
      method: 'POST',
      body: JSON.stringify({ punto: '01', ...payload }),
    }),

  adminRevokeAccess: (username: string, modulo: string, no_cia: string, punto = '01') =>
    request<any>(
      `/admin/users/${encodeURIComponent(username)}/access/?modulo=${modulo}&no_cia=${no_cia}&punto=${punto}`,
      { method: 'DELETE' },
    ),

  adminListCompanies: () =>
    request<{ companies: Company[] }>('/admin/companies/'),

  adminListModulesForCompany: (no_cia: string) =>
    request<{ no_cia: string; modules: string[] }>(`/admin/companies/${encodeURIComponent(no_cia)}/modules/`),

  adminGetDocPerms: (username: string, modulo: string, no_cia: string, punto = '01') =>
    request<{
      username: string
      modulo: string
      no_cia: string
      punto: string
      available: { tipo_docu: string; descripcion: string }[]
      assigned: { tipo_docu: string; por_defecto: boolean }[]
    }>(`/admin/users/${encodeURIComponent(username)}/access/${modulo}/docs/?no_cia=${no_cia}&punto=${punto}`),

  adminGrantDocAccess: (username: string, modulo: string, payload: { no_cia: string; punto?: string; tipo_docu: string; por_defecto?: boolean }) =>
    request<any>(`/admin/users/${encodeURIComponent(username)}/access/${modulo}/docs/`, {
      method: 'POST',
      body: JSON.stringify({ punto: '01', ...payload }),
    }),

  adminRevokeDocAccess: (username: string, modulo: string, no_cia: string, punto: string, tipo_docu: string) =>
    request<any>(
      `/admin/users/${encodeURIComponent(username)}/access/${modulo}/docs/?no_cia=${no_cia}&punto=${punto}&tipo_docu=${tipo_docu}`,
      { method: 'DELETE' },
    ),

  adminGetModuleFlags: (username: string, modulo: string, no_cia: string, punto = '01') =>
    request<{ username: string; modulo: string; no_cia: string; punto: string; flags: Record<string, boolean> }>(
      `/admin/users/${encodeURIComponent(username)}/access/${modulo}/flags/?no_cia=${no_cia}&punto=${punto}`,
    ),

  adminSetModuleFlag: (username: string, modulo: string, no_cia: string, punto: string, flag: string, value: boolean) =>
    request<{ flag: string; value: boolean }>(
      `/admin/users/${encodeURIComponent(username)}/access/${modulo}/flags/`,
      { method: 'PATCH', body: JSON.stringify({ no_cia, punto, flag, value }) },
    ),

  cntCias: () =>
    request<Array<Record<string, any>>>('/cnt/cias/'),

  cntGetCia: (no_cia: string) =>
    request<Record<string, any>>(`/cnt/cias/?no_cia=${encodeURIComponent(no_cia)}`),

  cntCreateCia: (payload: Record<string, any>) =>
    request<{ ok: boolean; no_cia: string }>('/cnt/cias/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  cntUpdateCia: (no_cia: string, payload: Record<string, any>) =>
    request<{ ok: boolean }>('/cnt/cias/', {
      method: 'PATCH',
      body: JSON.stringify({ no_cia, ...payload }),
    }),

  cntCreateSucursal: (payload: Record<string, any>) =>
    request<{ ok: boolean; punto: string }>('/cnt/sucursales/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  cntSucursales: (no_cia: string, punto?: string) => {
    const qs = new URLSearchParams({ no_cia })
    if (punto) qs.set('punto', punto)
    return request<Array<Record<string, any>>>(`/cnt/sucursales/?${qs.toString()}`)
  },

  cntUpdateSucursal: (no_cia: string, punto: string, payload: Record<string, any>) =>
    request<{ ok: boolean }>('/cnt/sucursales/', {
      method: 'PATCH',
      body: JSON.stringify({ no_cia, punto, ...payload }),
    }),

  cntGruposContables: () =>
    request<Array<Record<string, any>>>('/cnt/grupos-contables/'),

  cntCierreMensualInfo: (no_cia: string, punto: string) =>
    request<Record<string, any>>(
      `/cnt/cierre-mensual/?no_cia=${encodeURIComponent(no_cia)}&punto=${encodeURIComponent(punto)}`,
    ),

  cntEjecutarCierreMensual: (no_cia: string, punto: string) =>
    request<Record<string, any>>('/cnt/cierre-mensual/', {
      method: 'POST',
      body: JSON.stringify({ no_cia, punto }),
    }),

  cntAutorizarMes: (no_cia: string, punto: string, ano: number, mes: number) =>
    request<{ ok: boolean; asientos_autorizados: number }>('/cnt/autorizar-mes/', {
      method: 'POST',
      body: JSON.stringify({ no_cia, punto, ano, mes }),
    }),

  cntAutorizarMesAnterior: (no_cia: string, punto: string, ano: number, mes: number) =>
    request<{ ok: boolean; asientos_autorizados: number }>('/cnt/autorizar-mes-anterior/', {
      method: 'POST',
      body: JSON.stringify({ no_cia, punto, ano, mes }),
    }),

  cntCatalogoSucursal: (no_cia: string, punto: string) =>
    request<Array<Record<string, any>>>(
      `/cnt/catalogo-sucursal/?no_cia=${encodeURIComponent(no_cia)}&punto=${encodeURIComponent(punto)}`,
    ),

  cntAsignarCuentaSucursal: (no_cia: string, punto: string, cuenta: string, asignar: boolean) =>
    request<{ ok: boolean }>('/cnt/catalogo-sucursal/', {
      method: 'POST',
      body: JSON.stringify({ no_cia, punto, cuenta, asignar }),
    }),

  // ── FAT — Facturación ───────────────────────────────────────────────────────

  fatListDocumentTypes: (no_cia: string, punto = '01') =>
    request<{ no_cia: string; items: Array<{
      no_cia: string; tipo_docu: string; descripcion: string
      tipo_transaccion: string; codigo_ncf: string | null; activo: boolean
    }> }>(`/fat/documents/?no_cia=${encodeURIComponent(no_cia)}&punto=${encodeURIComponent(punto)}`),

  fatListCondicionesPago: () =>
    request<{ items: Array<{
      no_condicion_pago: string; descripcion: string
      plazo_pago: number; porciento: number; activa: boolean
    }> }>('/fat/condiciones-pago/'),

  fatUpsertCondicionPago: (data: Record<string, any>) =>
    request<{ action: string }>('/fat/condiciones-pago/', { method: 'POST', body: JSON.stringify(data) }),

  fatListFacturas: (params: {
    no_cia: string; punto?: string; page?: number; page_size?: number
    search?: string; tipo?: string; estado?: string; desde?: string; hasta?: string
  }) => {
    const p = new URLSearchParams()
    p.set('no_cia', params.no_cia)
    if (params.punto)     p.set('punto', params.punto)
    if (params.page)      p.set('page', String(params.page))
    if (params.page_size) p.set('page_size', String(params.page_size))
    if (params.search)    p.set('search', params.search)
    if (params.tipo)      p.set('tipo', params.tipo)
    if (params.estado)    p.set('estado', params.estado)
    if (params.desde)     p.set('desde', params.desde)
    if (params.hasta)     p.set('hasta', params.hasta)
    return request<{
      items: Array<Record<string, any>>
      total: number; page: number; page_size: number; total_pages: number
    }>(`/fat/facturas/?${p.toString()}`)
  },

  fatGetFactura: (no_cia: string, punto: string, tipo: string, no_factura: string) =>
    request<Record<string, any>>(
      `/fat/facturas/${encodeURIComponent(tipo)}/${encodeURIComponent(no_factura)}/?no_cia=${encodeURIComponent(no_cia)}&punto=${encodeURIComponent(punto)}`,
    ),

  fatListVendedores: (noCia: string) =>
    request<{ items: Array<{ vendedor: string; nombre: string }> }>(`/fat/vendedores/?no_cia=${encodeURIComponent(noCia)}`),

  fatListClientes: (no_cia: string, search = '', page = 1, page_size = 30, punto = '01') =>
    request<{
      items: Array<{
        punto: string; no_cliente: number; nombre: string; rnc: string; cedula: string
        telefono: string; ciudad: string; direccion: string; codigo_ncf: string; plazo: number
      }>
      total: number; page: number; page_size: number; total_pages: number
    }>(`/fat/clientes/?no_cia=${encodeURIComponent(no_cia)}&punto=${encodeURIComponent(punto)}&search=${encodeURIComponent(search)}&page=${page}&page_size=${page_size}`),

  fatListCompanias: () =>
    request<{ items: Array<Record<string, any>> }>('/fat/companias/'),

  fatUpsertCompania: (data: Record<string, any>) =>
    request<{ action: string }>('/fat/companias/', { method: 'POST', body: JSON.stringify(data) }),

  fatListPuntos: (no_cia: string) =>
    request<{ items: Array<Record<string, any>> }>(`/fat/puntos/?no_cia=${encodeURIComponent(no_cia)}`),

  fatUpsertPunto: (data: Record<string, any>, method: 'POST' | 'PATCH' = 'POST') =>
    request<Record<string, any>>('/fat/puntos/', { method, body: JSON.stringify(data) }),

  fatListTiposPago: (no_cia: string, punto: string) =>
    request<{ items: Array<Record<string, any>> }>(`/fat/tipos-pago/?no_cia=${encodeURIComponent(no_cia)}&punto=${encodeURIComponent(punto)}`),

  fatUpsertTipoPago: (data: Record<string, any>) =>
    request<{ action: string }>('/fat/tipos-pago/', { method: 'POST', body: JSON.stringify(data) }),

  fatListasPrecio: (no_cia: string, punto: string, no_lista = '') => {
    const p = new URLSearchParams({ no_cia, punto })
    if (no_lista) p.set('no_lista', no_lista)
    return request<{ tipos?: Array<Record<string, any>>; detalle?: Array<Record<string, any>> }>(`/fat/listas-precio/?${p.toString()}`)
  },

  fatUpsertListaPrecio: (data: Record<string, any>) =>
    request<Record<string, any>>('/fat/listas-precio/', { method: 'POST', body: JSON.stringify(data) }),

  fatDeleteListaPrecio: (data: Record<string, any>) =>
    request<Record<string, any>>('/fat/listas-precio/', { method: 'DELETE', body: JSON.stringify(data) }),

  fatListTransportistas: () =>
    request<{ items: Array<Record<string, any>> }>('/fat/transportistas/'),

  fatUpsertTransportista: (data: Record<string, any>) =>
    request<{ action: string }>('/fat/transportistas/', { method: 'POST', body: JSON.stringify(data) }),

  fatListNotas: () =>
    request<{ items: Array<Record<string, any>> }>('/fat/notas/'),

  fatUpsertNota: (data: Record<string, any>) =>
    request<{ action: string }>('/fat/notas/', { method: 'POST', body: JSON.stringify(data) }),

  fatListConduces: (no_cia: string, punto: string, page = 1, page_size = 30, search = '', tipo = '', ano = 0, mes = 0) => {
    const p = new URLSearchParams({ no_cia, punto, page: String(page), page_size: String(page_size) })
    if (search) p.set('search', search)
    if (tipo) p.set('tipo', tipo)
    if (ano) p.set('ano', String(ano))
    if (mes) p.set('mes', String(mes))
    return request<{ items: Array<Record<string, any>>; total: number }>(`/fat/conduces/?${p.toString()}`)
  },

  fatGetConduce: (no_cia: string, punto: string, tipo: string, no_conduce: string) =>
    request<Record<string, any>>(`/fat/conduces/${encodeURIComponent(tipo)}/${encodeURIComponent(no_conduce)}/?no_cia=${encodeURIComponent(no_cia)}&punto=${encodeURIComponent(punto)}`),

  fatCuadreCaja: (no_cia: string, punto: string, ano: number, mes: number, no_cuadre = '') => {
    const p = new URLSearchParams({ no_cia, punto, ano: String(ano), mes: String(mes) })
    if (no_cuadre) p.set('no_cuadre', no_cuadre)
    return request<{ items?: Array<Record<string, any>>; detalle?: Array<Record<string, any>> }>(`/fat/cuadre-caja/?${p.toString()}`)
  },

  fatRepVentas: (no_cia: string, punto: string, desde: string, hasta: string) =>
    request<{ items: Array<Record<string, any>>; total_neto: number; total_itbis: number; count: number }>(
      `/fat/rep-ventas/?no_cia=${encodeURIComponent(no_cia)}&punto=${encodeURIComponent(punto)}&desde=${desde}&hasta=${hasta}`),

  fatRep607: (no_cia: string, punto: string, desde: string, hasta: string) =>
    request<{ items: Array<Record<string, any>>; total_neto: number; total_itbis: number; count: number }>(
      `/fat/rep-607/?no_cia=${encodeURIComponent(no_cia)}&punto=${encodeURIComponent(punto)}&desde=${desde}&hasta=${hasta}`),

  fatRepNcfNulos: (no_cia: string, punto: string, desde: string, hasta: string) =>
    request<{ items: Array<Record<string, any>>; count: number }>(
      `/fat/rep-ncf-nulos/?no_cia=${encodeURIComponent(no_cia)}&punto=${encodeURIComponent(punto)}&desde=${desde}&hasta=${hasta}`),

  fatRepFacturasRnc: (noCia: string, punto: string, desde: string, hasta: string, tipoDocu = 'T', rnc = '', noCliente = '') => {
    const p = new URLSearchParams({ no_cia: noCia, punto, desde, hasta, tipo_docu: tipoDocu })
    if (rnc) p.set('rnc', rnc)
    if (noCliente) p.set('no_cliente', noCliente)
    return request<{ items: Array<Record<string, any>>; total_neto: number; count: number }>(`/fat/rep-facturas-rnc/?${p.toString()}`)
  },

  fatRepMargenBruto: (noCia: string, punto: string, desde: string, hasta: string, agrupar = 'producto', tipoDocu = 'T', vendedor = '', almacen = '', noCliente = '', noProdu = '') => {
    const p = new URLSearchParams({ no_cia: noCia, punto, desde, hasta, agrupar, tipo_docu: tipoDocu })
    if (vendedor) p.set('vendedor', vendedor)
    if (almacen) p.set('almacen', almacen)
    if (noCliente) p.set('no_cliente', noCliente)
    if (noProdu) p.set('no_produ', noProdu)
    return request<{ items: Array<Record<string, any>>; total_venta: number; total_costo: number; total_beneficio: number; margen_pct: number; count: number }>(`/fat/rep-margen-bruto/?${p.toString()}`)
  },


  fatRepVentasVendedor: (noCia: string, punto: string, desde: string, hasta: string) =>
    request<{ items: Array<Record<string, any>>; total_neto: number; count: number }>(
      `/fat/rep-ventas-vendedor/?no_cia=${encodeURIComponent(noCia)}&punto=${encodeURIComponent(punto)}&desde=${desde}&hasta=${hasta}`),

  fatRepVentasCliente: (noCia: string, punto: string, desde: string, hasta: string) =>
    request<{ items: Array<Record<string, any>>; total_neto: number; count: number }>(
      `/fat/rep-ventas-cliente/?no_cia=${encodeURIComponent(noCia)}&punto=${encodeURIComponent(punto)}&desde=${desde}&hasta=${hasta}`),

  fatRepAnalitica: (noCia: string, punto: string, ano: number) =>
    request<Record<string, any>>(
      `/fat/rep-analitica/?no_cia=${encodeURIComponent(noCia)}&punto=${encodeURIComponent(punto)}&ano=${ano}`),


  // --- CXC Cuentas por Cobrar ---
  cxcListCias: () => request<any[]>('/cxc/cias/'),
  cxcSaveCia: (d: any) => request<any>('/cxc/cias/', { method: 'POST', body: JSON.stringify(d) }),
  cxcListPuntos: (noCia: string) => request<any[]>(`/cxc/puntos/?no_cia=${noCia}`),
  cxcSavePunto: (d: any) => request<any>('/cxc/puntos/', { method: 'POST', body: JSON.stringify(d) }),
  cxcListTdocu: (noCia: string) => request<any[]>(`/cxc/tdocu/?no_cia=${noCia}`),
  cxcSaveTdocu: (d: any) => request<any>('/cxc/tdocu/', { method: 'POST', body: JSON.stringify(d) }),
  cxcDeleteTdocu: (noCia: string, tipoDoc: string) => request<any>('/cxc/tdocu/', { method: 'DELETE', body: JSON.stringify({ no_cia: noCia, tipo_doc: tipoDoc }) }),
  cxcListTcli: (noCia: string) => request<any[]>(`/cxc/tcli/?no_cia=${noCia}`),
  cxcSaveTcli: (d: any) => request<any>('/cxc/tcli/', { method: 'POST', body: JSON.stringify(d) }),
  cxcDeleteTcli: (noCia: string, tipoCli: string) => request<any>('/cxc/tcli/', { method: 'DELETE', body: JSON.stringify({ no_cia: noCia, tipo_cli: tipoCli }) }),
  cxcListSupervisores: (noCia: string) => request<any[]>(`/cxc/supervisores/?no_cia=${noCia}`),
  cxcSaveSupervisor: (d: any) => request<any>('/cxc/supervisores/', { method: 'POST', body: JSON.stringify(d) }),
  cxcDeleteSupervisor: (noCia: string, supervisor: string) => request<any>('/cxc/supervisores/', { method: 'DELETE', body: JSON.stringify({ no_cia: noCia, supervisor }) }),
  cxcListVendedores: (noCia: string) => request<any[]>(`/cxc/vendedores/?no_cia=${noCia}`),
  cxcSaveVendedor: (d: any) => request<any>('/cxc/vendedores/', { method: 'POST', body: JSON.stringify(d) }),
  cxcDeleteVendedor: (noCia: string, vendedor: string) => request<any>('/cxc/vendedores/', { method: 'DELETE', body: JSON.stringify({ no_cia: noCia, vendedor }) }),
  cxcListRutas: (noCia: string) => request<any[]>(`/cxc/rutas/?no_cia=${noCia}`),
  cxcSaveRuta: (d: any) => request<any>('/cxc/rutas/', { method: 'POST', body: JSON.stringify(d) }),
  cxcDeleteRuta: (noCia: string, ruta: string) => request<any>('/cxc/rutas/', { method: 'DELETE', body: JSON.stringify({ no_cia: noCia, ruta }) }),
  cxcListTcontable: (noCia: string) => request<any[]>(`/cxc/tcontable/?no_cia=${noCia}`),
  cxcSaveTcontable: (d: any) => request<any>('/cxc/tcontable/', { method: 'POST', body: JSON.stringify(d) }),
  cxcDeleteTcontable: (noCia: string, tipoConta: string) => request<any>('/cxc/tcontable/', { method: 'DELETE', body: JSON.stringify({ no_cia: noCia, tipo_conta: tipoConta }) }),
  cxcListCiudades: (noCia: string) => request<any[]>(`/cxc/ciudades/?no_cia=${noCia}`),
  cxcSaveCiudad: (d: any) => request<any>('/cxc/ciudades/', { method: 'POST', body: JSON.stringify(d) }),
  cxcDeleteCiudad: (noCia: string, ciudad: string) => request<any>('/cxc/ciudades/', { method: 'DELETE', body: JSON.stringify({ no_cia: noCia, ciudad }) }),
  cxcListBarrios: (noCia: string) => request<any[]>(`/cxc/barrios/?no_cia=${noCia}`),
  cxcSaveBarrio: (d: any) => request<any>('/cxc/barrios/', { method: 'POST', body: JSON.stringify(d) }),
  cxcDeleteBarrio: (noCia: string, barrio: string) => request<any>('/cxc/barrios/', { method: 'DELETE', body: JSON.stringify({ no_cia: noCia, barrio }) }),
  cxcListZonas: (noCia: string) => request<any[]>(`/cxc/zonas/?no_cia=${noCia}`),
  cxcSaveZona: (d: any) => request<any>('/cxc/zonas/', { method: 'POST', body: JSON.stringify(d) }),
  cxcDeleteZona: (noCia: string, zona: string) => request<any>('/cxc/zonas/', { method: 'DELETE', body: JSON.stringify({ no_cia: noCia, zona }) }),
  cxcListCadenas: (noCia: string) => request<any[]>(`/cxc/cadenas/?no_cia=${noCia}`),
  cxcSaveCadena: (d: any) => request<any>('/cxc/cadenas/', { method: 'POST', body: JSON.stringify(d) }),
  cxcDeleteCadena: (noCia: string, cadena: string) => request<any>('/cxc/cadenas/', { method: 'DELETE', body: JSON.stringify({ no_cia: noCia, cadena }) }),
  cxcListClientes: (noCia: string, q = '', page = 1) => request<{ items: any[]; count: number }>(`/cxc/clientes/?no_cia=${noCia}&q=${encodeURIComponent(q)}&page=${page}`),
  cxcGetCliente: (noCia: string, noCliente: string) => request<any>(`/cxc/clientes/${noCia}/${noCliente}/`),
  cxcSaveCliente: (d: any) => request<any>('/cxc/clientes/', { method: 'POST', body: JSON.stringify(d) }),
  cxcDeleteCliente: (noCia: string, noCliente: string) => request<any>(`/cxc/clientes/${noCia}/${noCliente}/`, { method: 'DELETE' }),
  cxcGetClientesRuta: (noCia: string, ruta: string) => request<any[]>(`/cxc/clientes-ruta/?no_cia=${noCia}&ruta=${ruta}`),
  cxcAsignarClienteRuta: (d: any) => request<any>('/cxc/clientes-ruta/', { method: 'POST', body: JSON.stringify(d) }),
  cxcListDocumentos: (p: Record<string, any>) => { const qs = new URLSearchParams(Object.fromEntries(Object.entries(p).filter(([,v]) => v != null && v !== ''))).toString(); return request<{ items: any[]; count: number }>(`/cxc/documentos/?${qs}`)},
  cxcGetSaldosMenores: (noCia: string, punto: string, maxSaldo?: number) => {
    const qs = new URLSearchParams({ no_cia: noCia, punto })
    if (maxSaldo != null) qs.set('max_saldo', String(maxSaldo))
    return request<any>(`/cxc/saldos-menores/?${qs.toString()}`)
  },
  cxcAplicarSaldosMenores: (p: { no_cia: string; punto: string; max_saldo: number; fecha: string; motivo?: string }) =>
    request<any>('/cxc/saldos-menores/', { method: 'POST', body: JSON.stringify(p) }),
  cxpGetSaldosMenores: (noCia: string, punto: string, maxSaldo?: number) => {
    const qs = new URLSearchParams({ no_cia: noCia, punto })
    if (maxSaldo != null) qs.set('max_saldo', String(maxSaldo))
    return request<any>(`/cxp/saldos-menores/?${qs.toString()}`)
  },
  cxpAplicarSaldosMenores: (p: { no_cia: string; punto: string; max_saldo: number; fecha: string; motivo?: string }) =>
    request<any>('/cxp/saldos-menores/', { method: 'POST', body: JSON.stringify(p) }),
  cxcGetDocumento: (noCia: string, noDoc: string, tipoDoc = '') => {
    const qs = tipoDoc ? `?tipo_doc=${encodeURIComponent(tipoDoc)}` : ''
    return request<any>(`/cxc/documentos/${noCia}/${noDoc}/${qs}`)
  },
  cxcSaveDocumento: (d: any) => request<any>('/cxc/documentos/', { method: 'POST', body: JSON.stringify(d) }),
  cxcFacturasPendientesCliente: (noCia: string, noCliente: string, punto = '') =>
    request<any[]>(`/cxc/clientes/${encodeURIComponent(noCliente)}/facturas-pendientes/?no_cia=${noCia}${punto ? `&punto=${punto}` : ''}`),
  cxcCrearRecibo: (d: any) =>
    request<any>('/cxc/recibos/', { method: 'POST', body: JSON.stringify(d) }),
  cxcGetNextDoc: (noCia: string, punto: string) => request<{ no_doc: string }>(`/cxc/next-doc/?no_cia=${noCia}&punto=${punto}`),
  cxcReversar: (d: any) => request<any>('/cxc/reversar/', { method: 'POST', body: JSON.stringify(d) }),
  cxcGetDocsPendientesMasivo: (noCia: string, desde: string, hasta: string) => request<any[]>(`/cxc/pagos-masivos/?no_cia=${noCia}&desde=${desde}&hasta=${hasta}`),
  cxcAplicarPagosMasivos: (d: any) => request<any>('/cxc/pagos-masivos/', { method: 'POST', body: JSON.stringify(d) }),
  cxcGetDebitosCliente: (noCia: string, noCliente: string, noDocCr: string) => request<any[]>(`/cxc/liberar-credito/?no_cia=${noCia}&no_cliente=${noCliente}&no_doc_cr=${noDocCr}`),
  cxcLiberarCredito: (d: any) => request<any>('/cxc/liberar-credito/', { method: 'POST', body: JSON.stringify(d) }),
  cxcCorregirNcf: (d: any) => request<any>('/cxc/corregir-ncf/', { method: 'POST', body: JSON.stringify(d) }),
  cxcEstadoCuenta: (noCia: string, noCliente: string) => request<any>(`/cxc/estado-cuenta/?no_cia=${noCia}&no_cliente=${noCliente}`),
  cxcBalanceClientes: (noCia: string, punto?: string) => request<any[]>(`/cxc/balance-clientes/?no_cia=${noCia}${punto ? '&punto='+punto : ''}`),
  cxcHistorico: (noCia: string, noCliente?: string, desde?: string, hasta?: string) => { const qs = new URLSearchParams({ no_cia: noCia, ...(noCliente && { no_cliente: noCliente }), ...(desde && { desde }), ...(hasta && { hasta }) }).toString(); return request<any[]>(`/cxc/historico/?${qs}`)},
  cxcLibroVentas: (noCia: string, desde: string, hasta: string, punto?: string) => request<any[]>(`/cxc/libro-ventas/?no_cia=${noCia}&desde=${desde}&hasta=${hasta}${punto ? '&punto='+punto : ''}`),
  cxcRepEnvejecimiento: (noCia: string, punto?: string, vendedor?: string, fechaCorte?: string) => { const qs = new URLSearchParams({ no_cia: noCia, ...(punto && { punto }), ...(vendedor && { vendedor }), ...(fechaCorte && { fecha_corte: fechaCorte }) }).toString(); return request<any>(`/cxc/rep-envejecimiento/?${qs}`)},
  cxcRepCobrosVendedor: (noCia: string, desde: string, hasta: string, punto?: string) => request<any>(`/cxc/rep-cobros-vendedor/?no_cia=${noCia}&desde=${desde}&hasta=${hasta}${punto ? '&punto='+punto : ''}`),
  cxcRepComisiones: (noCia: string, desde: string, hasta: string, punto?: string) => request<any>(`/cxc/rep-comisiones/?no_cia=${noCia}&desde=${desde}&hasta=${hasta}${punto ? '&punto='+punto : ''}`),
  cxcRepNcf: (noCia: string, desde: string, hasta: string, punto?: string) => request<any>(`/cxc/rep-ncf/?no_cia=${noCia}&desde=${desde}&hasta=${hasta}${punto ? '&punto='+punto : ''}`),
  cxcAsientoContable: (noCia: string, punto: string, mes: number, ano: number) => request<any[]>(`/cxc/asiento-contable/?no_cia=${noCia}&punto=${punto}&mes=${mes}&ano=${ano}`),
  cxcAsientosGenerados: (noCia: string, punto: string, limit = 24) => request<any[]>(`/cxc/asientos-generados/?no_cia=${noCia}&punto=${punto}&limit=${limit}`),
  cxcGenerarAsiento: (d: any) => request<any>('/cxc/generar-asiento/', { method: 'POST', body: JSON.stringify(d) }),
  cxcCierre: (d: any) => request<any>('/cxc/cierre/', { method: 'POST', body: JSON.stringify(d) }),
  fatAsientoContable: (no_cia: string, punto: string, mes: number, ano: number) =>
    request<any[]>(`/fat/asiento-contable/?no_cia=${encodeURIComponent(no_cia)}&punto=${encodeURIComponent(punto)}&mes=${mes}&ano=${ano}`),

  fatAsientosGenerados: (no_cia: string, punto: string, limit = 24) =>
    request<any[]>(`/fat/asientos-generados/?no_cia=${encodeURIComponent(no_cia)}&punto=${encodeURIComponent(punto)}&limit=${limit}`),

  fatListCierres: (no_cia: string, punto: string) =>
    request<{ items: Array<Record<string, any>> }>(`/fat/cierres/?no_cia=${encodeURIComponent(no_cia)}&punto=${encodeURIComponent(punto)}`),

  fatCierreMensual: (no_cia: string, punto: string, ano: number, mes: number) =>
    request<{ success: boolean; message: string }>('/fat/cierres/', {
      method: 'POST', body: JSON.stringify({ no_cia, punto, ano, mes }),
    }),

  fatGenerarAsientos: (no_cia: string, punto: string, ano: number, mes: number, mode: 'preview' | 'generar' = 'preview') => {
    if (mode === 'generar') {
      return request<{ generados: number; errores: number }>('/fat/generar-asientos/', {
        method: 'POST',
        body: JSON.stringify({ no_cia, punto, ano, mes }),
      })
    }
    const p = new URLSearchParams({ no_cia, punto, ano: String(ano), mes: String(mes) })
    return request<{ items: Array<Record<string, any>>; count: number }>(`/fat/generar-asientos/?${p.toString()}`)
  },

  fatSearchProductos: (noCia: string, punto: string, noLista = '', search = '', page = 1, pageSize = 20, almacen?: string, soloExistencia?: boolean) => {
    const p = new URLSearchParams({ no_cia: noCia, punto, page: String(page), page_size: String(pageSize) })
    if (noLista) p.set('no_lista', noLista)
    if (search) p.set('search', search)
    if (almacen) p.set('almacen', almacen)
    if (soloExistencia) p.set('solo_existencia', 'true')
    return request<{
      items: Array<{ no_produ: string; descri: string; precio: number; porciento_impuesto: number; activo: boolean; existencia: number; unidad_empaque: string }>
      total: number; page: number; page_size: number; total_pages: number
    }>(`/fat/productos/?${p.toString()}`)
  },

  // Existencia por almacén de un producto (calculada desde TINV_MOVIMIENTO E-S).
  // Pega contra el mismo endpoint INV /inv/existencia/<no_produ>/ que usa
  // la pantalla "Existencia por Producto", para tener un único cálculo.
  invExistenciaProducto: (noCia: string, noProdu: string) => {
    const p = new URLSearchParams({ no_cia: noCia })
    return request<{
      results: Array<{
        no_cia: string; punto: string; almacen: string; almacen_desc: string
        no_produ: string; descripcion: string
        existencia: number; costo_actual: number; valor: number
        exist_minima: number; exist_maxima: number
      }>
      count: number
    }>(`/inv/existencia/${encodeURIComponent(noProdu)}/?${p.toString()}`)
  },

  // Movimientos de un producto con balance corrido (equivalente al Rinv304 del legado).
  // Cantidades normalizadas al empaque para_reporte del producto.
  invMovimientosProducto: (noCia: string, noProdu: string, punto = '', almacen = '', desde = '', hasta = '') => {
    const p = new URLSearchParams({ no_cia: noCia })
    if (punto) p.set('punto', punto)
    if (almacen) p.set('almacen', almacen)
    if (desde) p.set('desde', desde)
    if (hasta) p.set('hasta', hasta)
    return request<{
      no_produ: string
      items: Array<{
        punto: string; almacen: string; tipo_docu: string; no_docu: string
        fecha: string; entrada: number; salida: number; balance: number
        costo: number; st_anulado: string
      }>
      totales: { entradas: number; salidas: number; balance: number }
    }>(`/inv/movimientos/${encodeURIComponent(noProdu)}/?${p.toString()}`)
  },

  // Empaques (unidades alternas) de un producto. Devuelve [] si TINV_EMPAQUE no tiene filas.
  fatProductoEmpaques: (noProdu: string) => {
    const p = new URLSearchParams({ no_produ: noProdu })
    return request<{ items: Array<{ unidad: string; descripcion: string; por_defecto: boolean; cant_por_emp: number }> }>(
      `/fat/producto-empaques/?${p.toString()}`,
    )
  },

  fatProximoNcf: (no_cia: string, codigo_ncf: string) =>
    request<{
      codigo_ncf: string
      prox_ncf: number
      posiciones_fijas: string
      descripcion: string
      ncf_dgi_proximo: string
      agotado: boolean
    }>(`/fat/proximo-ncf/?no_cia=${encodeURIComponent(no_cia)}&codigo_ncf=${encodeURIComponent(codigo_ncf)}`),

  fatNcfUsado: (no_cia: string, ncf: number, codigo_ncf = '') =>
    request<{ usado: boolean }>(
      `/fat/ncf-usado/?no_cia=${encodeURIComponent(no_cia)}&ncf=${encodeURIComponent(String(ncf))}${codigo_ncf ? `&codigo_ncf=${encodeURIComponent(codigo_ncf)}` : ''}`,
    ),

  fatProximoNoFactura: (no_cia: string, punto: string, tipo_docu: string) => {
    const p = new URLSearchParams({ no_cia, punto, tipo_docu })
    return request<{ tipo_docu: string; prox_no_factura: number }>(`/fat/proximo-no-factura/?${p}`)
  },

  fatCrearFactura: (data: Record<string, any>) =>
    request<{ no_factura: string; tipo_factura: string; ncf: number | null; total_neto: number }>('/fat/facturas/', {
      method: 'POST', body: JSON.stringify(data),
    }),

  fatAnularFactura: (data: { no_cia: string; punto?: string; tipo_factura: string; no_factura: string; usuario?: string; motivo?: string; liberar_ncf?: boolean; tipo_anula_dgii?: string }) =>
    request<{ no_factura: string; tipo_factura: string; anulado: boolean; motivo: string }>('/fat/facturas/anular/', {
      method: 'POST', body: JSON.stringify(data),
    }),

  fatMotivosAnulacion: () =>
    request<{ items: Array<{ tipo: string; descripcion: string }> }>('/fat/anulacion-motivos/'),

  fatCajeroPendientes: (no_cia: string, punto: string, fecha?: string) => {
    const p = new URLSearchParams({ no_cia, punto })
    if (fecha) p.set('fecha', fecha)
    return request<{
      fecha: string
      items: Array<{
        tipo_factura: string; no_factura: string; fecha: string | null; fecha_hora: string
        nombre_cliente: string; total_neto: number; forma_pago: string
        valor_recibido: number; valor_devuelto: number
        st_anulado: string; ncf_dgi: string
      }>
    }>(`/fat/cajero/pendientes/?${p.toString()}`)
  },

  fatCobrarFactura: (data: { no_cia: string; punto?: string; tipo_factura: string; no_factura: string; valor_recibido: number }) =>
    request<{ tipo_factura: string; no_factura: string; total_neto: number; valor_recibido: number; valor_devuelto: number }>('/fat/facturas/cobrar/', {
      method: 'POST', body: JSON.stringify(data),
    }),

  fatCrearConduce: (data: Record<string, any>) =>
    request<{ no_conduce: string; tipo_conduce: string; clase: string; total_neto: number }>('/fat/conduces/', {
      method: 'POST', body: JSON.stringify(data),
    }),

  fatActualizarConduce: (tipo: string, no_conduce: string, data: Record<string, any>) =>
    request<Record<string, any>>(`/fat/conduces/${encodeURIComponent(tipo)}/${encodeURIComponent(no_conduce)}/`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),

  // --- CXP (Cuentas por Pagar) ---

  cxpListProveedores: (params?: { search?: string; activo?: string }) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params ?? {}).filter(([,v]) => v != null && v !== ""))).toString()
    return request<any[]>(`/cxp/proveedores/${qs ? "?" + qs : ""}`)
  },

  cxpGetProveedor: (no: string) =>
    request<any>(`/cxp/proveedores/${encodeURIComponent(no)}/`),

  cxpSaveProveedor: (data: Record<string, unknown>) =>
    data.no_proveedor
      ? request<any>(`/cxp/proveedores/${data.no_proveedor}/`, { method: "PUT", body: JSON.stringify(data) })
      : request<any>("/cxp/proveedores/", { method: "POST", body: JSON.stringify(data) }),

  cxpGetProveedorCuenta: (no: string, noCia: string, punto: string) =>
    request<any>(`/cxp/proveedores/${encodeURIComponent(no)}/cuenta/?no_cia=${noCia}&punto=${punto}`),

  cxpListTiposGasto: () =>
    request<{ tipo_gasto: string; descripcion: string }[]>(`/cxp/tipos-gasto/`),

  cxpListTiposRetencion: () =>
    request<{ tipo_retencion: number; descripcion: string; por_defecto: string }[]>(`/cxp/tipos-retencion/`),

  cxpListFormasPago: () =>
    request<{ forma_pago: number; descripcion: string; por_defecto: string }[]>(`/cxp/formas-pago/`),

  cxpGetProveedorNcfInfo: (no: string, noCia: string, punto: string) =>
    request<{
      codigo_ncf: string | null
      posiciones_fijas?: string
      prox_ncf?: number
      ncf_inicial?: number
      ncf_final?: number
      descripcion?: string
      ncf_manual?: string
      ncf_opcional?: string
    }>(`/cxp/proveedores/${encodeURIComponent(no)}/ncf-info/?no_cia=${noCia}&punto=${punto}`),

  cxpListCuentasProveedor: (no: string, noCia: string, punto: string) =>
    request<any[]>(`/cxp/proveedores/${encodeURIComponent(no)}/cuentas/?no_cia=${noCia}&punto=${punto}`),

  cxpListMovimientosProveedor: (no: string, noCia: string, punto: string, desde = "", hasta = "") => {
    const qs = new URLSearchParams({ no_cia: noCia, punto, ...(desde && { desde }), ...(hasta && { hasta }) }).toString()
    return request<any[]>(`/cxp/proveedores/${encodeURIComponent(no)}/movimientos/?${qs}`)
  },

  cxpListDocumentos: (params: {
    no_cia: string; punto: string;
    no_proveedor?: string; tipo?: string; no_doc?: string;
    desde?: string; hasta?: string; status?: string;
  }) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""))).toString()
    return request<any[]>(`/cxp/documentos/?${qs}`)
  },

  cxpGetDocumento: (no_cia: string, punto: string, tipo: string, no: string) =>
    request<any>(`/cxp/documentos/${no_cia}/${punto}/${tipo}/${no}/`),

  cxpEstadoCuenta: (noCia: string, noProveedor: string, punto = '') => {
    const qs = new URLSearchParams({ no_cia: noCia, no_proveedor: noProveedor })
    if (punto) qs.set('punto', punto)
    return request<any>(`/cxp/estado-cuenta/?${qs.toString()}`)
  },

  cxpGetAging: (params: { no_cia: string; punto?: string; no_proveedor?: string }) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v != null && v !== ""))).toString()
    return request<any[]>(`/cxp/aging/?${qs}`)
  },

  cxpListTiposDocu: (noCia = "") =>
    request<any[]>(`/cxp/tipos-docu/${noCia ? "?no_cia=" + noCia : ""}`),

  // Configuración CxP
  cxpListCias: () => request<any[]>('/cxp/cias/'),
  cxpListPuntos: (noCia: string) => request<any[]>(`/cxp/puntos/?no_cia=${noCia}`),
  cxpListTproveedores: () => request<any[]>('/cxp/tproveedores/'),
  cxpListTdocuConfig: () => request<any[]>('/cxp/tdocu-config/'),
  cxpListCiudades: () => request<any[]>('/cxp/ciudades/'),
  cxpListBarrios: (ciudad = "") => request<any[]>(`/cxp/barrios/${ciudad ? "?ciudad=" + encodeURIComponent(ciudad) : ""}`),

  // Reportes CxP (read-only)
  cxpRepAlfabetico: (noCia: string, punto?: string, search?: string) => {
    const qs = new URLSearchParams({ no_cia: noCia, ...(punto && { punto }), ...(search && { search }) }).toString()
    return request<any>(`/cxp/rep-alfabetico/?${qs}`)
  },
  cxpRepMayor: (noCia: string, punto: string, desde: string, hasta: string, noProveedor?: string) => {
    const qs = new URLSearchParams({ no_cia: noCia, punto, desde, hasta, ...(noProveedor && { no_proveedor: noProveedor }) }).toString()
    return request<any>(`/cxp/rep-mayor/?${qs}`)
  },
  cxpRep606: (noCia: string, anio: number, mes: number, punto?: string) => {
    const qs = new URLSearchParams({ no_cia: noCia, anio: String(anio), mes: String(mes), ...(punto && { punto }) }).toString()
    return request<any>(`/cxp/rep-606/?${qs}`)
  },
  cxpRep607: (noCia: string, anio: number, mes: number, punto?: string) => {
    const qs = new URLSearchParams({ no_cia: noCia, anio: String(anio), mes: String(mes), ...(punto && { punto }) }).toString()
    return request<any>(`/cxp/rep-607/?${qs}`)
  },

  // Procesos CxP (escritura)
  cxpGetSiguienteNoDocu: (noCia: string, punto: string, tipoDocu: string) =>
    request<{ siguiente: string }>(`/cxp/entrada-documentos/?no_cia=${noCia}&punto=${punto}&tipo_docu=${encodeURIComponent(tipoDocu)}`),
  cxpEntradaDocumento: (data: Record<string, unknown>) =>
    request<{ ok: boolean; no_docu: string }>(`/cxp/entrada-documentos/`, { method: 'POST', body: JSON.stringify(data) }),
  cxpReversarDocumento: (data: { no_cia: string; punto: string; tipo_docu: string; no_docu: string; usuario?: string }) =>
    request<any>(`/cxp/reversar/`, { method: 'POST', body: JSON.stringify(data) }),
  cxpLiberarDebitoGet: (noCia: string, punto: string, noProveedor?: string, tipoMovi?: string) => {
    const qs = new URLSearchParams({ no_cia: noCia, punto, ...(noProveedor && { no_proveedor: noProveedor }), ...(tipoMovi && { tipo_movi: tipoMovi }) }).toString()
    return request<any[]>(`/cxp/liberar-debito/?${qs}`)
  },
  cxpLiberarDebitoPost: (data: { no_cia: string; punto: string; no_docu_cr: string; tipo_docu_cr: string; debitos: any[] }) =>
    request<any>(`/cxp/liberar-debito/`, { method: 'POST', body: JSON.stringify(data) }),
  cxpBloquearPago: (data: { no_cia: string; punto: string; tipo_docu: string; no_docu: string; bloquear: boolean }) =>
    request<any>(`/cxp/bloquear-pago/`, { method: 'POST', body: JSON.stringify(data) }),
  // Solicitudes de pago (Fcxp209 / Fcxp207 — puente CxP → CHC)
  cxpSolicitudChequeDocs: (noCia: string, punto: string, noProveedor: string) => {
    const qs = new URLSearchParams({ no_cia: noCia, punto, no_proveedor: noProveedor }).toString()
    return request<any[]>(`/cxp/solicitud-cheque/?${qs}`)
  },
  cxpGenerarSolicitudCheque: (data: {
    no_cia: string; punto: string; cuenta_banco: string; no_proveedor: string
    fecha_cheque?: string; detalle?: string; docs: { tipo_docu: string; no_docu: string; monto: number }[]
  }) =>
    request<{ ok: boolean; tipo_docu: string; no_docu: string; beneficiario: string; total: number; documentos: number }>(
      `/cxp/solicitud-cheque/`, { method: 'POST', body: JSON.stringify(data) }),
  cxpListSolicitudesPago: (params: { no_cia: string; punto: string; no_proveedor?: string; pendientes?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    ).toString()
    return request<any[]>(`/cxp/solicitudes-pago/?${qs}`)
  },
  cxpSolicitudReferencias: (noDocu: string, noCia: string, punto: string) => {
    const qs = new URLSearchParams({ no_cia: noCia, punto }).toString()
    return request<any[]>(`/cxp/solicitudes-pago/${encodeURIComponent(noDocu)}/referencias/?${qs}`)
  },
  cxpAsientoContable: (noCia: string, punto: string, mes: number, ano: number) => {
    const qs = new URLSearchParams({ no_cia: noCia, punto, mes: String(mes), ano: String(ano) }).toString()
    return request<any[]>(`/cxp/asiento-contable/?${qs}`)
  },
  cxpGenerarAsiento: (data: { no_cia: string; punto: string; mes_proceso: number; ano_proceso: number }) =>
    request<any>(`/cxp/generar-asiento/`, { method: 'POST', body: JSON.stringify(data) }),
  cxpCierre: (data: { no_cia: string; punto: string }) =>
    request<any>(`/cxp/cierre/`, { method: 'POST', body: JSON.stringify(data) }),

  // Acceso de usuarios CxP (FCXP103)
  cxpListUsuarios: (noCia = '', punto = '') => {
    const qs = new URLSearchParams({ ...(noCia && { no_cia: noCia }), ...(punto && { punto }) }).toString()
    return request<any[]>(`/cxp/usuarios/${qs ? '?' + qs : ''}`)
  },
  cxpSaveUsuario: (data: Record<string, unknown>) =>
    request<any>(`/cxp/usuarios/`, { method: 'POST', body: JSON.stringify(data) }),
  cxpDeleteUsuario: (noCia: string, punto: string, usuario: string) => {
    const qs = new URLSearchParams({ no_cia: noCia, punto, usuario }).toString()
    return request<any>(`/cxp/usuarios/?${qs}`, { method: 'DELETE' })
  },

  // Reportes adicionales
  cxpRepCuadre: (noCia: string, punto: string, mes: number, ano: number) => {
    const qs = new URLSearchParams({ no_cia: noCia, punto, mes: String(mes), ano: String(ano) }).toString()
    return request<any>(`/cxp/rep-cuadre/?${qs}`)
  },
  cxpRepRetenciones: (noCia: string, punto: string, ano: number, noProveedor = '') => {
    const qs = new URLSearchParams({ no_cia: noCia, punto, ano: String(ano), ...(noProveedor && { no_proveedor: noProveedor }) }).toString()
    return request<any>(`/cxp/rep-retenciones/?${qs}`)
  },

  // ============================================================
  // Órdenes de Compra (ODC)
  // ============================================================
  // Configuración
  odcListCias: () => request<any[]>('/odc/cias/'),
  odcSaveCia: (data: Record<string, unknown>) =>
    request<any>('/odc/cias/', { method: 'POST', body: JSON.stringify(data) }),
  odcListPuntos: (noCia: string) => request<any[]>(`/odc/puntos/?no_cia=${noCia}`),
  odcSavePunto: (data: Record<string, unknown>) =>
    request<any>('/odc/puntos/', { method: 'POST', body: JSON.stringify(data) }),
  odcListUsuarios: (noCia = '', punto = '') => {
    const qs = new URLSearchParams({ ...(noCia && { no_cia: noCia }), ...(punto && { punto }) }).toString()
    return request<any[]>(`/odc/usuarios/${qs ? '?' + qs : ''}`)
  },
  odcSaveUsuario: (data: Record<string, unknown>) =>
    request<any>('/odc/usuarios/', { method: 'POST', body: JSON.stringify(data) }),
  odcDeleteUsuario: (noCia: string, punto: string, usuario: string) => {
    const qs = new URLSearchParams({ no_cia: noCia, punto, usuario }).toString()
    return request<any>(`/odc/usuarios/?${qs}`, { method: 'DELETE' })
  },

  // Órdenes
  odcListOrdenes: (params: {
    no_cia: string; punto?: string; estado?: string; st_anulado?: string
    no_proveedor?: string; fecha_desde?: string; fecha_hasta?: string; limit?: number
  }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)])
    ).toString()
    return request<any[]>(`/odc/ordenes/?${qs}`)
  },
  odcGetOrden: (noCia: string, punto: string, noOrden: string) =>
    request<{ cabecera: any; lineas: any[] }>(`/odc/ordenes/${noCia}/${punto}/${noOrden}/`),
  odcCrearOrden: (data: Record<string, unknown>) =>
    request<{ no_orden: string }>('/odc/ordenes/crear/', { method: 'POST', body: JSON.stringify(data) }),
  odcAutorizarOrden: (data: { no_cia: string; punto: string; no_orden: string }) =>
    request<any>('/odc/ordenes/autorizar/', { method: 'POST', body: JSON.stringify(data) }),
  odcAnularOrden: (data: { no_cia: string; punto: string; no_orden: string; motivo?: string }) =>
    request<any>('/odc/ordenes/anular/', { method: 'POST', body: JSON.stringify(data) }),
  odcCerrarOrden: (data: { no_cia: string; punto: string; no_orden: string }) =>
    request<any>('/odc/ordenes/cerrar/', { method: 'POST', body: JSON.stringify(data) }),

  // Requisiciones
  odcListRequisiciones: (params: {
    no_cia: string; punto?: string; estado?: string
    fecha_desde?: string; fecha_hasta?: string; limit?: number
  }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)])
    ).toString()
    return request<any[]>(`/odc/requisiciones/?${qs}`)
  },
  odcGetRequisicion: (noCia: string, punto: string, noRequisicion: string) =>
    request<{ cabecera: any; lineas: any[] }>(`/odc/requisiciones/${noCia}/${punto}/${noRequisicion}/`),
  odcCrearRequisicion: (data: Record<string, unknown>) =>
    request<{ no_requisicion: string }>('/odc/requisiciones/crear/', { method: 'POST', body: JSON.stringify(data) }),
  odcAutorizarRequisicion: (data: { no_cia: string; punto: string; no_requisicion: string; slot?: number }) =>
    request<any>('/odc/requisiciones/autorizar/', { method: 'POST', body: JSON.stringify(data) }),
  odcAnularRequisicion: (data: { no_cia: string; punto: string; no_requisicion: string; motivo?: string }) =>
    request<any>('/odc/requisiciones/anular/', { method: 'POST', body: JSON.stringify(data) }),
  odcCerrarRequisicion: (data: { no_cia: string; punto: string; no_requisicion: string }) =>
    request<any>('/odc/requisiciones/cerrar/', { method: 'POST', body: JSON.stringify(data) }),

  // Reportes
  odcRepOrdenesPendientes: (params: {
    no_cia: string; punto?: string; fecha_desde?: string; fecha_hasta?: string
  }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)])
    ).toString()
    return request<any[]>(`/odc/rep-ordenes-pendientes/?${qs}`)
  },
  odcRepResumen: (params: {
    no_cia: string; punto?: string; fecha_desde?: string; fecha_hasta?: string
  }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)])
    ).toString()
    return request<any>(`/odc/rep-resumen/?${qs}`)
  },
  odcRepRequisicionesPendientes: (params: { no_cia: string; punto?: string; limit?: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)])
    ).toString()
    return request<any[]>(`/odc/rep-requisiciones-pendientes/?${qs}`)
  },

  // ============================================================
  // Caja Chica (ACC)
  // ============================================================
  accListCias: () => request<any[]>('/acc/cias/'),
  accSaveCia: (data: Record<string, unknown>) =>
    request<any>('/acc/cias/', { method: 'POST', body: JSON.stringify(data) }),
  accListPuntos: (noCia: string) => request<any[]>(`/acc/puntos/?no_cia=${noCia}`),
  accListCajas: (noCia: string, punto?: string) => {
    const qs = new URLSearchParams({ no_cia: noCia, ...(punto && { punto }) }).toString()
    return request<any[]>(`/acc/cajas/?${qs}`)
  },
  accSaveCaja: (data: Record<string, unknown>) =>
    request<any>('/acc/cajas/', { method: 'POST', body: JSON.stringify(data) }),
  accListBeneficiarios: (params: { activo?: string; search?: string } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    ).toString()
    return request<any[]>(`/acc/beneficiarios/${qs ? '?' + qs : ''}`)
  },
  accListTiposBene: () => request<any[]>('/acc/tipos-bene/'),
  accListTiposGasto: () => request<any[]>('/acc/tipos-gasto/'),
  accListDocumentos: (params: {
    no_cia: string; punto?: string; no_caja?: string
    fecha_desde?: string; fecha_hasta?: string; anulado?: string; limit?: number
  }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    ).toString()
    return request<any[]>(`/acc/documentos/?${qs}`)
  },
  accGetDocumento: (noCia: string, punto: string, noDocu: string) =>
    request<{ cabecera: any; lineas: any[] }>(`/acc/documentos/${noCia}/${punto}/${noDocu}/`),
  accCrearDocumento: (data: Record<string, unknown>) =>
    request<{ no_docu: string }>('/acc/documentos/crear/', { method: 'POST', body: JSON.stringify(data) }),
  accAnularDocumento: (data: { no_cia: string; punto: string; no_docu: string; motivo?: string }) =>
    request<any>('/acc/documentos/anular/', { method: 'POST', body: JSON.stringify(data) }),
  accListReposiciones: (params: {
    no_cia: string; punto?: string; no_caja?: string
    fecha_desde?: string; fecha_hasta?: string; limit?: number
  }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    ).toString()
    return request<any[]>(`/acc/reposiciones/?${qs}`)
  },
  accRepResumen: (params: { no_cia: string; punto?: string; fecha_desde?: string; fecha_hasta?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    ).toString()
    return request<any>(`/acc/rep-resumen/?${qs}`)
  },
  accRepGastosTipo: (params: { no_cia: string; punto?: string; fecha_desde?: string; fecha_hasta?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    ).toString()
    return request<any[]>(`/acc/rep-gastos-tipo/?${qs}`)
  },
  accGetReposicion: (noCia: string, punto: string, noRep: string) =>
    request<{ cabecera: any; documentos: any[] }>(`/acc/reposiciones/${noCia}/${punto}/${noRep}/`),
  accDocsPendientesReposicion: (params: { no_cia: string; punto?: string; no_caja?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    ).toString()
    return request<any[]>(`/acc/docs-pendientes-reposicion/?${qs}`)
  },
  accCrearReposicion: (data: Record<string, unknown>) =>
    request<{ no_reposicion: string }>('/acc/reposiciones/crear/', { method: 'POST', body: JSON.stringify(data) }),
  accAnularReposicion: (data: { no_cia: string; punto: string; no_reposicion: string; motivo?: string }) =>
    request<any>('/acc/reposiciones/anular/', { method: 'POST', body: JSON.stringify(data) }),
  accPreviewAsiento: (params: { no_cia: string; punto: string; ano: number; mes: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ).toString()
    return request<{ lineas: any[]; total_debito: number; total_credito: number; cuadra: boolean; documentos: number }>(`/acc/asiento/?${qs}`)
  },
  accGenerarAsiento: (data: { no_cia: string; punto: string; ano: number; mes: number }) =>
    request<{ documentos_actualizados: number }>('/acc/asiento/', { method: 'POST', body: JSON.stringify(data) }),
  accCierreStatus: (params: { no_cia: string; punto: string }) => {
    const qs = new URLSearchParams(params).toString()
    return request<{ punto: any; documentos_sin_contabilizar: number; documentos_sin_reposicion: number }>(`/acc/cierre/status/?${qs}`)
  },
  accListCierres: (params: { no_cia: string; punto: string; ano?: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    ).toString()
    return request<any[]>(`/acc/cierre/?${qs}`)
  },
  accAplicarCierre: (data: { no_cia: string; punto: string }) =>
    request<{ cerrado: string; nuevo_periodo: string }>('/acc/cierre/aplicar/', { method: 'POST', body: JSON.stringify(data) }),
  accListTiposGasto: () => request<any[]>('/acc/tipos-gasto/'),
  accSaveTipoGasto: (data: Record<string, unknown>) =>
    request<{ tipo_gasto: string }>('/acc/tipos-gasto/save/', { method: 'POST', body: JSON.stringify(data) }),
  accListTiposBene: () => request<any[]>('/acc/tipos-bene/'),
  accSaveTipoBene: (data: Record<string, unknown>) =>
    request<{ tipo_bene: string }>('/acc/tipos-bene/save/', { method: 'POST', body: JSON.stringify(data) }),
  accSaveBeneficiario: (data: Record<string, unknown>) =>
    request<{ no_bene: string }>('/acc/beneficiarios/save/', { method: 'POST', body: JSON.stringify(data) }),
  accDeleteBeneficiario: (noBene: string) =>
    request<{ ok: boolean }>(`/acc/beneficiarios/${encodeURIComponent(noBene)}/`, { method: 'DELETE' }),
  accDeleteTipoBene: (tipoBene: string) =>
    request<{ ok: boolean }>(`/acc/tipos-bene/${encodeURIComponent(tipoBene)}/`, { method: 'DELETE' }),
  accDeleteTipoGasto: (tipoGasto: string) =>
    request<{ ok: boolean }>(`/acc/tipos-gasto/${encodeURIComponent(tipoGasto)}/`, { method: 'DELETE' }),
  accDeleteCaja: (noCia: string, punto: string, noCaja: string) =>
    request<{ ok: boolean }>(`/acc/cajas/${encodeURIComponent(noCia)}/${encodeURIComponent(punto)}/${encodeURIComponent(noCaja)}/`, { method: 'DELETE' }),

  // ============================================================
  // Cheques / Bancos / Conciliación (CHC)
  // ============================================================
  chcListBancos: (activo = '') => request<any[]>(`/chc/bancos/${activo ? '?activo=' + activo : ''}`),
  chcSaveBanco: (data: Record<string, unknown>) =>
    request<any>('/chc/bancos/', { method: 'POST', body: JSON.stringify(data) }),
  chcListCias: () => request<any[]>('/chc/cias/'),
  chcListPuntos: (noCia: string) => request<any[]>(`/chc/puntos/?no_cia=${noCia}`),
  chcListCuentas: (params: { no_cia: string; punto?: string; activa?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    ).toString()
    return request<any[]>(`/chc/cuentas/?${qs}`)
  },
  chcGetSaldoCuenta: (noCia: string, punto: string, cuentaBanco: string) => {
    const qs = new URLSearchParams({ no_cia: noCia, punto, cuenta_banco: cuentaBanco }).toString()
    return request<any>(`/chc/cuentas/saldo/?${qs}`)
  },
  chcListCheques: (params: {
    no_cia: string; punto?: string; cuenta_banco?: string; status?: string
    conciliado?: string; entregado?: string; no_proveedor?: string
    fecha_desde?: string; fecha_hasta?: string; limit?: number
  }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    ).toString()
    return request<any[]>(`/chc/cheques/?${qs}`)
  },
  chcGetCheque: (noCia: string, punto: string, tipoDocu: string, noDocu: string) =>
    request<any>(`/chc/cheques/${noCia}/${punto}/${tipoDocu}/${noDocu}/`),
  chcListTiposDocu: () => request<any[]>('/chc/tipos-docu/'),
  chcAnularCheque: (data: { no_cia: string; punto: string; tipo_docu: string; no_docu: string; motivo?: string }) =>
    request<any>('/chc/cheques/anular/', { method: 'POST', body: JSON.stringify(data) }),
  chcEntregarCheque: (data: {
    no_cia: string; punto: string; tipo_docu: string; no_docu: string
    entregado_a?: string; cedula?: string; fecha_entrega?: string
  }) =>
    request<any>('/chc/cheques/entregar/', { method: 'POST', body: JSON.stringify(data) }),
  chcSolicitarCheque: (data: {
    no_cia: string; punto: string; cuenta_banco: string
    tipo_docu?: string; beneficiario: string; valor_original: number
    fecha_cheque?: string; no_proveedor?: string
    moneda_cuenta?: string; detalle1?: string
  }) =>
    request<any>('/chc/cheques/solicitar/', { method: 'POST', body: JSON.stringify(data) }),
  chcConciliarCheque: (data: { no_cia: string; punto: string; tipo_docu: string; no_docu: string }) =>
    request<any>('/chc/cheques/conciliar/', { method: 'POST', body: JSON.stringify(data) }),
  chcListCierres: (params: { no_cia: string; punto?: string; cuenta_banco?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    ).toString()
    return request<any[]>(`/chc/cierres/?${qs}`)
  },
  chcRepResumenCuenta: (params: { no_cia: string; punto: string; cuenta_banco: string; fecha_desde: string; fecha_hasta: string }) => {
    const qs = new URLSearchParams(params).toString()
    return request<any>(`/chc/rep-resumen-cuenta/?${qs}`)
  },
  chcRepBalance: (params: { no_cia: string; punto?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    ).toString()
    return request<any[]>(`/chc/rep-balance/?${qs}`)
  },
  chcRepDisponibilidad: (params: { no_cia: string; punto?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    ).toString()
    return request<any[]>(`/chc/rep-disponibilidad/?${qs}`)
  },
  chcRepMovimientos: (params: { no_cia: string; punto: string; cuenta_banco: string; fecha_desde: string; fecha_hasta: string }) => {
    const qs = new URLSearchParams(params).toString()
    return request<any>(`/chc/rep-movimientos/?${qs}`)
  },
  chcRepDiario: (params: { no_cia: string; punto: string; fecha_desde: string; fecha_hasta: string; cuenta_banco?: string; tipo_docu?: string; status?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    ).toString()
    return request<any>(`/chc/rep-diario/?${qs}`)
  },
  chcConciliarBulk: (data: { no_cia: string; punto: string; items: { tipo_docu: string; no_docu: string }[] }) =>
    request<any>('/chc/cheques/conciliar-bulk/', { method: 'POST', body: JSON.stringify(data) }),
  chcCierreConciliacion: (data: { no_cia: string; punto: string; cuenta_banco: string; ano: number; mes: number }) =>
    request<any>('/chc/cierres/conciliacion/', { method: 'POST', body: JSON.stringify(data) }),

  // ============================================================
  // Nómina (SDN)
  // ============================================================
  sdnListCias: () => request<any[]>('/sdn/cias/'),
  sdnListAfp: () => request<any[]>('/sdn/afp/'),
  sdnSaveAfp: (d: Record<string, unknown>) =>
    request<{ no_afp: string }>('/sdn/afp/', { method: 'POST', body: JSON.stringify(d) }),
  sdnDeleteAfp: (noAfp: string) =>
    request<{ ok: boolean }>(`/sdn/afp/${encodeURIComponent(noAfp)}/`, { method: 'DELETE' }),
  sdnListArs: () => request<any[]>('/sdn/ars/'),
  sdnSaveArs: (d: Record<string, unknown>) =>
    request<{ no_ars: string }>('/sdn/ars/', { method: 'POST', body: JSON.stringify(d) }),
  sdnDeleteArs: (noArs: string) =>
    request<{ ok: boolean }>(`/sdn/ars/${encodeURIComponent(noArs)}/`, { method: 'DELETE' }),
  sdnListGerencias: () => request<any[]>('/sdn/gerencias/'),
  sdnSaveGerencia: (d: Record<string, unknown>) =>
    request<{ no_gerencia: string }>('/sdn/gerencias/', { method: 'POST', body: JSON.stringify(d) }),
  sdnDeleteGerencia: (noGerencia: string) =>
    request<{ ok: boolean }>(`/sdn/gerencias/${encodeURIComponent(noGerencia)}/`, { method: 'DELETE' }),
  sdnListAreas: () => request<any[]>('/sdn/areas/'),
  sdnSaveArea: (d: Record<string, unknown>) =>
    request<any>('/sdn/areas/', { method: 'POST', body: JSON.stringify(d) }),
  sdnDeleteArea: (noGerencia: string, noArea: string) =>
    request<{ ok: boolean }>(
      `/sdn/areas/${encodeURIComponent(noGerencia)}/${encodeURIComponent(noArea)}/`,
      { method: 'DELETE' },
    ),
  sdnListDeptos: () => request<any[]>('/sdn/deptos/'),
  sdnSaveDepto: (d: Record<string, unknown>) =>
    request<any>('/sdn/deptos/', { method: 'POST', body: JSON.stringify(d) }),
  sdnDeleteDepto: (noGerencia: string, noArea: string, noDepto: string) =>
    request<{ ok: boolean }>(
      `/sdn/deptos/${encodeURIComponent(noGerencia)}/${encodeURIComponent(noArea)}/${encodeURIComponent(noDepto)}/`,
      { method: 'DELETE' },
    ),
  sdnListIngresos: (status = 'A') => request<any[]>(`/sdn/ingresos/?status=${status}`),
  sdnListDeducciones: (status = 'A') => request<any[]>(`/sdn/deducciones/?status=${status}`),
  sdnAplicarDeduccionMasiva: (data: {
    no_cia: string; punto: string; nomina: string
    ano: number; mes: number; periodo: number
    no_deduccion: string
    empleados_ids?: number[]
    dry_run?: boolean
  }) => request<{
    deduccion: any; periodo: string
    preview?: any[]; aplicados?: any[]; saltados: any[]
    total_monto: number; cantidad: number; dry_run: boolean
  }>('/sdn/deduccion-masiva/', { method: 'POST', body: JSON.stringify(data) }),
  sdnListEmpleados: (params: { no_cia: string; punto?: string; nomina?: string; activos?: string; search?: string; limit?: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    ).toString()
    return request<any[]>(`/sdn/empleados/?${qs}`)
  },
  sdnGetEmpleado: (noCia: string, noEmpleado: number) =>
    request<any>(`/sdn/empleados/${noCia}/${noEmpleado}/`),
  sdnListNominas: (params: { no_cia: string; punto?: string; estado?: string; ano?: number; mes?: number; limit?: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    ).toString()
    return request<any[]>(`/sdn/nominas/?${qs}`)
  },
  sdnListVacaciones: (params: { no_cia: string; punto?: string; nomina?: string; ano?: number; limit?: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    ).toString()
    return request<any[]>(`/sdn/vacaciones/?${qs}`)
  },
  sdnGetVolante: (params: { no_cia: string; punto: string; nomina: string }) => {
    const qs = new URLSearchParams(params as any).toString()
    return request<any>(`/sdn/nominas/volante/?${qs}`)
  },
  sdnCrearNomina: (data: Record<string, unknown>) =>
    request<any>('/sdn/nominas/crear/', { method: 'POST', body: JSON.stringify(data) }),
  sdnActualizarNomina: (data: Record<string, unknown>) =>
    request<any>('/sdn/nominas/actualizar/', { method: 'POST', body: JSON.stringify(data) }),
  sdnAnularNomina: (data: { no_cia: string; punto: string; nomina: string }) =>
    request<any>('/sdn/nominas/anular/', { method: 'POST', body: JSON.stringify(data) }),
  sdnCalcularNomina: (data: { no_cia: string; punto: string; nomina: string }) =>
    request<any>('/sdn/nominas/calcular/', { method: 'POST', body: JSON.stringify(data) }),
  sdnReabrirNomina: (data: { no_cia: string; punto: string; nomina: string }) =>
    request<any>('/sdn/nominas/reabrir/', { method: 'POST', body: JSON.stringify(data) }),
  sdnRepResumenEmpleados: (noCia: string) => request<any>(`/sdn/rep-empleados/?no_cia=${noCia}`),
  sdnRepNominasResumen: (noCia: string, ano?: number) => {
    const qs = new URLSearchParams({ no_cia: noCia, ...(ano && { ano: String(ano) }) }).toString()
    return request<any[]>(`/sdn/rep-nominas/?${qs}`)
  },
  // Movimientos manuales (Fsdn204/205)
  sdnListMovimientos: (p: { no_cia: string; punto: string; nomina: string; ano: number; mes: number; periodo?: number; no_empleado?: number; tipo?: string; origen?: string }) => {
    const qs = new URLSearchParams({
      no_cia: p.no_cia, punto: p.punto, nomina: p.nomina,
      ano: String(p.ano), mes: String(p.mes), periodo: String(p.periodo ?? 1),
      ...(p.no_empleado && { no_empleado: String(p.no_empleado) }),
      ...(p.tipo && { tipo: p.tipo }),
      ...(p.origen && { origen: p.origen }),
    }).toString()
    return request<any[]>(`/sdn/movimientos/?${qs}`)
  },
  sdnCrearMovimiento: (data: Record<string, unknown>) =>
    request<any>('/sdn/movimientos/crear/', { method: 'POST', body: JSON.stringify(data) }),
  sdnEliminarMovimiento: (data: Record<string, unknown>) =>
    request<any>('/sdn/movimientos/eliminar/', { method: 'POST', body: JSON.stringify(data) }),
  // Generar Vacaciones (Fsdn401)
  sdnGenerarVacaciones: (data: { no_cia: string; punto: string; nomina: string; ano: number; dry_run?: boolean }) =>
    request<any>('/sdn/vacaciones/generar/', { method: 'POST', body: JSON.stringify(data) }),
  // Generar Solicitud de Cheques (Fsdn409)
  sdnPreviewCheques: (p: { no_cia: string; punto: string; nomina: string }) => {
    const qs = new URLSearchParams({ no_cia: p.no_cia, punto: p.punto, nomina: p.nomina }).toString()
    return request<any>(`/sdn/cheques/preview/?${qs}`)
  },
  // Informe de Nómina (Fsdn207)
  sdnRepInforme: (p: { no_cia: string; punto: string; nomina: string; ano: number; mes: number; periodo?: number; no_empleado?: number; no_gerencia?: string; no_area?: string; no_depto?: string }) => {
    const qs = new URLSearchParams({
      no_cia: p.no_cia, punto: p.punto, nomina: p.nomina,
      ano: String(p.ano), mes: String(p.mes), periodo: String(p.periodo ?? 1),
      ...(p.no_empleado && { no_empleado: String(p.no_empleado) }),
      ...(p.no_gerencia && { no_gerencia: p.no_gerencia }),
      ...(p.no_area && { no_area: p.no_area }),
      ...(p.no_depto && { no_depto: p.no_depto }),
    }).toString()
    return request<any>(`/sdn/rep-informe/?${qs}`)
  },
  // RNC Empleados (DGII)
  sdnRepEmpleadosRnc: (p: { no_cia: string; punto?: string; activos?: boolean; search?: string }) => {
    const qs = new URLSearchParams({
      no_cia: p.no_cia,
      activos: p.activos === false ? '0' : '1',
      ...(p.punto && { punto: p.punto }),
      ...(p.search && { search: p.search }),
    }).toString()
    return request<any[]>(`/sdn/rep-rnc/?${qs}`)
  },

  // ============================================================
  // Activos Fijos (ACF)
  // ============================================================
  acfListCias: () => request<any[]>('/acf/cias/'),
  acfListPuntos: (noCia: string) => request<any[]>(`/acf/puntos/?no_cia=${noCia}`),
  acfListCategorias: () => request<any[]>('/acf/categorias/'),
  acfCreateCategoria: (d: { categoria: number | string; descripcion: string; porciento?: number }) =>
    request<any>('/acf/categorias/', { method: 'POST', body: JSON.stringify(d) }),
  acfUpdateCategoria: (categoria: string | number, d: { descripcion: string; porciento?: number }) =>
    request<any>(`/acf/categorias/${categoria}/`, { method: 'PATCH', body: JSON.stringify(d) }),
  acfDeleteCategoria: (categoria: string | number) =>
    request<any>(`/acf/categorias/${categoria}/`, { method: 'DELETE' }),

  acfListGrupos: () => request<any[]>('/acf/grupos/'),
  acfCreateGrupo: (d: { tipo: string; grupo: string; descripcion: string }) =>
    request<any>('/acf/grupos/', { method: 'POST', body: JSON.stringify(d) }),
  acfUpdateGrupo: (tipo: string, grupo: string, d: { descripcion: string }) =>
    request<any>(`/acf/grupos/${encodeURIComponent(tipo)}/${encodeURIComponent(grupo)}/`, { method: 'PATCH', body: JSON.stringify(d) }),
  acfDeleteGrupo: (tipo: string, grupo: string) =>
    request<any>(`/acf/grupos/${encodeURIComponent(tipo)}/${encodeURIComponent(grupo)}/`, { method: 'DELETE' }),

  acfListSubgrupos: () => request<any[]>('/acf/subgrupos/'),
  acfCreateSubgrupo: (d: { tipo: string; grupo: string; subgrupo: string; descripcion: string }) =>
    request<any>('/acf/subgrupos/', { method: 'POST', body: JSON.stringify(d) }),
  acfUpdateSubgrupo: (tipo: string, grupo: string, subgrupo: string, d: { descripcion: string }) =>
    request<any>(`/acf/subgrupos/${encodeURIComponent(tipo)}/${encodeURIComponent(grupo)}/${encodeURIComponent(subgrupo)}/`, { method: 'PATCH', body: JSON.stringify(d) }),
  acfDeleteSubgrupo: (tipo: string, grupo: string, subgrupo: string) =>
    request<any>(`/acf/subgrupos/${encodeURIComponent(tipo)}/${encodeURIComponent(grupo)}/${encodeURIComponent(subgrupo)}/`, { method: 'DELETE' }),

  acfListMarcas: () => request<any[]>('/acf/marcas/'),
  acfCreateMarca: (d: { marca: string; descripcion: string }) =>
    request<any>('/acf/marcas/', { method: 'POST', body: JSON.stringify(d) }),
  acfUpdateMarca: (marca: string, d: { descripcion: string }) =>
    request<any>(`/acf/marcas/${encodeURIComponent(marca)}/`, { method: 'PATCH', body: JSON.stringify(d) }),
  acfDeleteMarca: (marca: string) =>
    request<any>(`/acf/marcas/${encodeURIComponent(marca)}/`, { method: 'DELETE' }),

  acfListResponsables: () => request<any[]>('/acf/responsables/'),
  acfCreateResponsable: (d: { responsable: string; nombre: string }) =>
    request<any>('/acf/responsables/', { method: 'POST', body: JSON.stringify(d) }),
  acfUpdateResponsable: (responsable: string, d: { nombre: string }) =>
    request<any>(`/acf/responsables/${encodeURIComponent(responsable)}/`, { method: 'PATCH', body: JSON.stringify(d) }),
  acfDeleteResponsable: (responsable: string) =>
    request<any>(`/acf/responsables/${encodeURIComponent(responsable)}/`, { method: 'DELETE' }),

  acfListDepartamentos: () => request<any[]>('/acf/departamentos/'),
  acfCreateDepartamento: (d: { departamento: string; descripcion: string }) =>
    request<any>('/acf/departamentos/', { method: 'POST', body: JSON.stringify(d) }),
  acfUpdateDepartamento: (departamento: string, d: { descripcion: string }) =>
    request<any>(`/acf/departamentos/${encodeURIComponent(departamento)}/`, { method: 'PATCH', body: JSON.stringify(d) }),
  acfDeleteDepartamento: (departamento: string) =>
    request<any>(`/acf/departamentos/${encodeURIComponent(departamento)}/`, { method: 'DELETE' }),
  acfListActivos: (params: {
    no_cia: string; punto?: string; status?: string; tipo?: string
    grupo?: string; departamento?: string; search?: string; limit?: number
  }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    ).toString()
    return request<any[]>(`/acf/activos/?${qs}`)
  },
  acfGetActivo: (noCia: string, punto: string, noActivo: string) =>
    request<any>(`/acf/activos/${noCia}/${punto}/${noActivo}/`),
  acfRepResumen: (noCia: string, punto?: string) => {
    const qs = new URLSearchParams({ no_cia: noCia, ...(punto && { punto }) }).toString()
    return request<any>(`/acf/rep-resumen/?${qs}`)
  },
  acfRepPorGrupo: (noCia: string, punto?: string) => {
    const qs = new URLSearchParams({ no_cia: noCia, ...(punto && { punto }) }).toString()
    return request<any[]>(`/acf/rep-por-grupo/?${qs}`)
  },
  acfRepPorDepartamento: (noCia: string, punto?: string) => {
    const qs = new URLSearchParams({ no_cia: noCia, ...(punto && { punto }) }).toString()
    return request<any[]>(`/acf/rep-por-departamento/?${qs}`)
  },
  acfRepValuacion: (noCia: string, punto?: string) => {
    const qs = new URLSearchParams({ no_cia: noCia, ...(punto && { punto }) }).toString()
    return request<any>(`/acf/rep-valuacion/?${qs}`)
  },
  acfCrearCompra: (body: any) =>
    request<{ no_activo: string; no_docu: string; tipo_docu: string }>(
      '/acf/compra/', { method: 'POST', body: JSON.stringify(body) }),
  acfCrearRetiro: (body: any) =>
    request<{ no_activo: string; no_docu: string; tipo_docu: string; valor_libros: number }>(
      '/acf/retiro/', { method: 'POST', body: JSON.stringify(body) }),
  acfDepreciacionPreview: (noCia: string, punto: string) => {
    const qs = new URLSearchParams({ no_cia: noCia, punto }).toString()
    return request<{ periodo: string; metodo: string; cantidad: number; total_estimado: number; error?: string }>(
      `/acf/depreciacion/preview/?${qs}`)
  },
  acfAplicarDepreciacion: (body: any) =>
    request<{ periodo: string; procesados: number; total_depreciado: number }>(
      '/acf/depreciacion/', { method: 'POST', body: JSON.stringify(body) }),
  acfCierreStatus: (noCia: string, punto: string) => {
    const qs = new URLSearchParams({ no_cia: noCia, punto }).toString()
    return request<any>(`/acf/cierre/status/?${qs}`)
  },
  acfListCierres: (noCia: string, punto: string, ano?: number) => {
    const qs = new URLSearchParams({ no_cia: noCia, punto, ...(ano && { ano: String(ano) }) }).toString()
    return request<any[]>(`/acf/cierres/?${qs}`)
  },
  acfAplicarCierre: (body: { no_cia: string; punto: string }) =>
    request<{ cerrado: string; nuevo_periodo: string }>(
      '/acf/cierre/', { method: 'POST', body: JSON.stringify(body) }),

  // ============================================================
  // Manuales (MAN)
  // ============================================================
  manListManuales: () => request<any[]>('/man/manuales/'),
  manListCsc: () => request<any[]>('/man/csc/'),

  // ============================================================
  // MCP — admin tokens y monitoreo de uso
  // ============================================================
  mcpListTokens: (filtros: { usuario?: string; activos?: string; q?: string } = {}) => {
    const params: Record<string, string> = {}
    if (filtros.usuario) params.usuario = filtros.usuario
    if (filtros.activos) params.activos = filtros.activos
    if (filtros.q) params.q = filtros.q
    const qs = new URLSearchParams(params).toString()
    return request<{ items: any[] }>(`/admin/mcp/tokens/${qs ? `?${qs}` : ''}`)
  },
  mcpCreateToken: (payload: any) =>
    request<{ token_id: string; plaintext: string }>(
      '/admin/mcp/tokens/', { method: 'POST', body: JSON.stringify(payload) }),
  mcpRevokeToken: (token_id: string) =>
    request<{ ok: boolean }>(
      `/admin/mcp/tokens/${token_id}/`,
      { method: 'PATCH', body: JSON.stringify({ st_activo: 'N' }) }),
  mcpTokenUsage: (token_id: string) =>
    request<{ items: any[] }>(`/admin/mcp/tokens/${token_id}/usage/`),
  mcpUsage: (filtros: Record<string, string | undefined> = {}) => {
    const params: Record<string, string> = {}
    for (const [k, v] of Object.entries(filtros)) if (v) params[k] = v
    const qs = new URLSearchParams(params).toString()
    return request<any>(`/admin/mcp/usage/${qs ? `?${qs}` : ''}`)
  },

}

export const api = regalGeneralApi
