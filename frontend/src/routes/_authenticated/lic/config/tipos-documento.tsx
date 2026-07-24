import { createFileRoute } from '@tanstack/react-router'
import { LicTiposDocumento } from '@/features/lic/lic-tipos-documento'

export const Route = createFileRoute('/_authenticated/lic/config/tipos-documento')({
  component: LicTiposDocumento,
})
