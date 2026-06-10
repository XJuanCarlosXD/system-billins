import { createFileRoute } from '@tanstack/react-router'
import { ChcCuentas } from '@/features/chc/chc-cuentas'

export const Route = createFileRoute('/_authenticated/chc/cuentas')({
  component: ChcCuentas,
})
