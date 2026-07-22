import { createFileRoute } from '@tanstack/react-router'
import { ReportesPage } from '@/features/reportes/reportes-page'

export const Route = createFileRoute('/_authenticated/reportes')({
  component: ReportesPage,
})
