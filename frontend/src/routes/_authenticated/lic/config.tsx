import { createFileRoute } from '@tanstack/react-router'
import { LicConfig } from '@/features/lic/lic-config'

export const Route = createFileRoute('/_authenticated/lic/config')({
  component: LicConfig,
})
