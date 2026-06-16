import { createFileRoute } from '@tanstack/react-router'
import { SdnMovimientos } from '@/features/sdn/sdn-movimientos'
export const Route = createFileRoute('/_authenticated/sdn/movimientos')({ component: SdnMovimientos })
