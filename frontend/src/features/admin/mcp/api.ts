import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import type { McpToken, McpTokenCreatePayload, McpTokenUsageItem } from './types'

export function useMcpTokens(filtros: { usuario?: string; activos?: string; q?: string }) {
  return useQuery({
    queryKey: ['mcp', 'tokens', filtros],
    queryFn: async () => (await api.mcpListTokens(filtros)).items as McpToken[],
    staleTime: 30_000,
  })
}

export function useCreateMcpToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: McpTokenCreatePayload) => api.mcpCreateToken(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mcp', 'tokens'] }),
  })
}

export function useRevokeMcpToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (token_id: string) => api.mcpRevokeToken(token_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mcp', 'tokens'] }),
  })
}

export function useMcpTokenUsage(token_id: string | null) {
  return useQuery({
    queryKey: ['mcp', 'tokens', token_id, 'usage'],
    enabled: !!token_id,
    queryFn: async () => (await api.mcpTokenUsage(token_id!)).items as McpTokenUsageItem[],
  })
}

export type McpUsageResponse = {
  kpis: {
    total_calls: number; calls_ok: number; calls_error: number; error_rate: number
    p50_ms: number; p95_ms: number; p99_ms: number
    usuarios_activos: number; tokens_activos: number
    downloads_pdf: number; downloads_xlsx: number
  }
  serie_temporal: { bucket: string; ok: number; error: number; p95_ms: number }[]
  top_tools: { tool: string; calls: number; error_rate: number; p95_ms: number }[]
  top_usuarios: { usuario: string; calls: number; ultimo_uso: string }[]
  top_errores: { error_code: string; calls: number; ultima_tool: string }[]
}

export function useMcpUsage(filtros: Record<string, string | undefined>) {
  return useQuery<McpUsageResponse>({
    queryKey: ['mcp', 'usage', filtros],
    queryFn: () => api.mcpUsage(filtros),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}
