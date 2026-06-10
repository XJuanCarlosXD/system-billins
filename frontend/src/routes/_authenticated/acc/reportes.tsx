import { createFileRoute } from '@tanstack/react-router'
import { AccReportes } from '@/features/acc/acc-reportes'

export const Route = createFileRoute('/_authenticated/acc/reportes')({
  component: AccReportes,
})
