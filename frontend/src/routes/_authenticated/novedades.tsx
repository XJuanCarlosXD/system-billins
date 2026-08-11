import { createFileRoute } from '@tanstack/react-router'
import { NovedadesPage } from '@/features/novedades'

export const Route = createFileRoute('/_authenticated/novedades')({
  component: NovedadesPage,
})
