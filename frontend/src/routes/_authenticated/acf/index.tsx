import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/acf/')({
  beforeLoad: () => { throw redirect({ to: '/acf/activos' }) },
})
