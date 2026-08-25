// Cliente API contra el backend (Django + Oracle).
// Sesión por cookie (HttpOnly) — credentials: 'include' en cada fetch.

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

// Cuando el backend cae a página HTML (login redirect, 500 con debug page,
// Netlify sirviendo el index en un path no-API), text arranca con "<!DOCTYPE"
// y JSON.parse tira SyntaxError críptico. Convertimos a ApiError con el
// status real para que la UI muestre algo accionable.
export function parseJsonOrThrow(text: string, status: number): any {
  if (!text) return null
  try { return JSON.parse(text) }
  catch {
    const snippet = text.slice(0, 200).replace(/\s+/g, ' ').trim()
    throw new ApiError(status, `Respuesta no-JSON del servidor (HTTP ${status}): ${snippet}`)
  }
}

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
  full_name?: string | null
  role?: string | null
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
  full_name?: string | null
  role?: string | null
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
  posiciones_fijas?: string
  descripcion?: string
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
export const apiClient = {
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

  adminCreateUser: (username: string, password: string, full_name?: string, role?: string) =>
    request<{ username: string; created: boolean }>('/admin/users/', {
      method: 'POST',
      body: JSON.stringify({ username, password, full_name, role }),
    }),

  adminGetUser: (username: string) =>
    request<AdminUser>(`/admin/users/${encodeURIComponent(username)}/`),

  adminUpdateUser: (
    username: string,
    payload: { new_password?: string; locked?: boolean; full_name?: string; role?: string },
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

  dashboardVentasMes: (no_cia = '01') =>
    request<{ items: { dia: string; total: number }[]; ano: number; mes: number }>(
      `/dashboard/ventas-mes/?no_cia=${encodeURIComponent(no_cia)}`,
    ),
}
