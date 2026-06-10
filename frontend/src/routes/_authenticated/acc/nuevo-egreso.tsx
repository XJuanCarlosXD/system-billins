import { createFileRoute } from '@tanstack/react-router'
import { AccNuevoEgreso } from '@/features/acc/acc-nuevo-egreso'
export const Route = createFileRoute('/_authenticated/acc/nuevo-egreso')({ component: AccNuevoEgreso })
