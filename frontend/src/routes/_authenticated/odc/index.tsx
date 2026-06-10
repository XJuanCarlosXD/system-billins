import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/odc/')({
  beforeLoad: () => { throw redirect({ to: '/odc/ordenes' }) },
})
