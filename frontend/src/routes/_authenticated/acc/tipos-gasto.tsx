import { createFileRoute } from '@tanstack/react-router'
import { AccTiposGasto } from '@/features/acc/acc-tipos-gasto'
export const Route = createFileRoute('/_authenticated/acc/tipos-gasto')({ component: AccTiposGasto })
