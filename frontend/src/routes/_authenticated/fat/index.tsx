import { createFileRoute, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/_authenticated/fat/')({
  loader: () => { throw redirect({ to: '/fat/facturas' }) },
})