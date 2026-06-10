import { createFileRoute } from '@tanstack/react-router'
import { ChcConciliar } from '@/features/chc/chc-stubs'
export const Route = createFileRoute('/_authenticated/chc/conciliar')({ component: ChcConciliar })
