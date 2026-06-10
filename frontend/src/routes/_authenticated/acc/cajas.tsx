import { createFileRoute } from '@tanstack/react-router'
import { AccCajas } from '@/features/acc/acc-cajas'

export const Route = createFileRoute('/_authenticated/acc/cajas')({
  component: AccCajas,
})
