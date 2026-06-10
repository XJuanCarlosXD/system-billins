import { createFileRoute } from '@tanstack/react-router'
import { AccNuevoEgreso } from '@/features/acc/acc-stub'
export const Route = createFileRoute('/_authenticated/acc/nuevo-egreso')({ component: AccNuevoEgreso })
