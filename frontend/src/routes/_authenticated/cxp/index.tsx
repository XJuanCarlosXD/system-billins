import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/cxp/')({
  beforeLoad: () => { throw redirect({ to: '/cxp/proveedores' }) },
  component: () => null,
})
