import { createFileRoute } from '@tanstack/react-router'
import { NcfAlertsPage } from '@/features/ncf-alerts'

export const Route = createFileRoute('/_authenticated/ncf-alerts')({
  component: NcfAlertsPage,
})
