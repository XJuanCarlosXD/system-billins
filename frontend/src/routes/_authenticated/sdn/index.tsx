import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/sdn/')({
  beforeLoad: () => { throw redirect({ to: '/sdn/empleados' }) },
})
