import { useQuery } from '@tanstack/react-query'
import { regalGeneralApi } from '@/lib/regal-general-api'

/**
 * Hook que expone los permisos del usuario actual de manera densa.
 * Cachea con staleTime: Infinity — los permisos cambian poco durante una sesion.
 */
export function useAccess() {
  const q = useQuery({
    queryKey: ['me-access'],
    queryFn: () => regalGeneralApi.meAccess(),
    staleTime: Infinity,
    retry: 1,
  })

  const data = q.data
  const isAdmin = data?.is_admin ?? false

  return {
    isLoading: q.isLoading,
    error: q.error,
    isAdmin,
    username: data?.username,
    companies: data?.companies ?? [],
    modules: data?.modules ?? {},
    hasModule: (m: string) => isAdmin || !!data?.modules?.[m.toLowerCase()],
    hasFlag: (m: string, no_cia: string, punto: string, flag: string) =>
      isAdmin ||
      data?.flags?.[`${m.toLowerCase()}:${no_cia}:${punto}`]?.includes(flag) ||
      false,
    hasDocType: (m: string, no_cia: string, punto: string, t: string) =>
      isAdmin ||
      data?.tipos_docu?.[`${m.toLowerCase()}:${no_cia}:${punto}`]?.includes(t) ||
      false,
    defaultDocType: (m: string, no_cia: string, punto: string) =>
      data?.tipos_docu_default?.[`${m.toLowerCase()}:${no_cia}:${punto}`],
  }
}
