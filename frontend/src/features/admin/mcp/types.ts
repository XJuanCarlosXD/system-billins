export type McpToken = {
  token_id: string
  usuario: string
  no_cia: string | null
  bloquear_cia: 'S' | 'N'
  punto: string | null
  bloquear_punto: 'S' | 'N'
  nombre: string
  prefijo: string
  fecha_creacion: string
  fecha_expira: string | null
  fecha_ultimo_uso: string | null
  ip_ultimo_uso: string | null
  st_activo: 'S' | 'N'
  creado_por: string
}

export type McpTokenCreatePayload = {
  usuario: string
  nombre: string
  no_cia?: string
  bloquear_cia?: boolean
  punto?: string
  bloquear_punto?: boolean
  expira_dias?: number | null
  expira_fecha?: string | null
  no_expira?: boolean
}

export type McpTokenUsageItem = {
  fecha: string
  tool: string
  ok: 'S' | 'N'
  error_code: string | null
  duration_ms: number
  ip: string | null
}
