import { createFileRoute } from '@tanstack/react-router'
import { CxpMovimientos } from '@/features/cxp/movimientos'

export const Route = createFileRoute('/_authenticated/cxp/movimientos')({
  component: CxpMovimientos,
})
