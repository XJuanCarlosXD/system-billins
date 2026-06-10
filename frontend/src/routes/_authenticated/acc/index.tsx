import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/acc/')({
  beforeLoad: () => { throw redirect({ to: '/acc/documentos' }) },
})
