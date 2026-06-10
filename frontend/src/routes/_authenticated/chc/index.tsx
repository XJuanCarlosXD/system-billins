import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/chc/')({
  beforeLoad: () => { throw redirect({ to: '/chc/cuentas' }) },
})
