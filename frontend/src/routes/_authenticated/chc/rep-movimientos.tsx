import { createFileRoute } from '@tanstack/react-router'
import { ChcRepMovimientos } from '@/features/chc/chc-rep-movimientos'
export const Route = createFileRoute('/_authenticated/chc/rep-movimientos')({ component: ChcRepMovimientos })
