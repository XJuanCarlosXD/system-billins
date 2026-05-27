import { createFileRoute } from '@tanstack/react-router'
import { CxpCuentas } from '@/features/cxp/cuentas'

export const Route = createFileRoute('/_authenticated/cxp/cuentas')({
  component: CxpCuentas,
})
