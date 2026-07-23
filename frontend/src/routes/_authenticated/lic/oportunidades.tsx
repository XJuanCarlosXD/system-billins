import { createFileRoute } from '@tanstack/react-router'
import { LicOportunidades } from '@/features/lic/lic-oportunidades'

export const Route = createFileRoute('/_authenticated/lic/oportunidades')({
  component: LicOportunidades,
})
