import { useQuery } from '@tanstack/react-query'
import { regalGeneralApi, type Me } from '@/lib/regal-general-api'

export function useMe() {
  return useQuery<Me>({
    queryKey: ['me'],
    queryFn: () => regalGeneralApi.me(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

export function useCurrentUsername(): string {
  const { data } = useMe()
  return data?.username ?? ''
}
