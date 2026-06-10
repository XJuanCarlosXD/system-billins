import { createFileRoute } from '@tanstack/react-router'
import { SdnVacaciones } from '@/features/sdn/sdn-vacaciones'

export const Route = createFileRoute('/_authenticated/sdn/vacaciones')({
  component: SdnVacaciones,
})
