import { createFileRoute } from '@tanstack/react-router'
import { ChcRepMovimientos } from '@/features/chc/chc-stubs'
export const Route = createFileRoute('/_authenticated/chc/rep-movimientos')({ component: ChcRepMovimientos })
