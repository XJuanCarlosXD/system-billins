import { createFileRoute } from '@tanstack/react-router'
import { HistorialAdmin } from '@/features/historial/historial-admin'

export const Route = createFileRoute('/_authenticated/sistema/historial')({
  component: HistorialAdmin,
})
