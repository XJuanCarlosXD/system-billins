import { createFileRoute } from '@tanstack/react-router'
import { RequireAdmin } from '@/components/access'
import { HistorialAdmin } from '@/features/historial/historial-admin'

export const Route = createFileRoute('/_authenticated/sistema/historial')({
  component: GuardedHistorialAdmin,
})

function GuardedHistorialAdmin() {
  return (
    <RequireAdmin>
      <HistorialAdmin />
    </RequireAdmin>
  )
}
