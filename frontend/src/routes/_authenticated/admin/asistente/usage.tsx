import { createFileRoute } from '@tanstack/react-router'
import { AsistenteAdminUsagePage } from '@/features/asistente/admin-usage-page'

export const Route = createFileRoute('/_authenticated/admin/asistente/usage')({
  component: AsistenteAdminUsagePage,
})
