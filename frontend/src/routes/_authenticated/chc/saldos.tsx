import { createFileRoute } from '@tanstack/react-router'
import { ChcSaldos } from '@/features/chc/chc-saldos'
export const Route = createFileRoute('/_authenticated/chc/saldos')({ component: ChcSaldos })
