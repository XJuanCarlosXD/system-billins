import { createFileRoute, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/_authenticated/cxc/')({
  loader: () => { throw redirect({ to: '/cxc/clientes' }) },
})