import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/inv/')({
  beforeLoad: () => { throw redirect({ to: '/inv/productos' }) },
  component: () => null,
})
