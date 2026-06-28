import { createFileRoute } from '@tanstack/react-router'
import { ChcConciliar } from '@/features/chc/chc-conciliar'
export const Route = createFileRoute('/_authenticated/chc/conciliar')({ component: ChcConciliar })
