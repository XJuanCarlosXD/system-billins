import { createFileRoute } from '@tanstack/react-router'
import { CxpAging } from '@/features/cxp/aging'

export const Route = createFileRoute('/_authenticated/cxp/envejecimiento')({
  component: CxpAging,
})
