import { createFileRoute } from '@tanstack/react-router'
import { AccBeneficiarios } from '@/features/acc/acc-beneficiarios'

export const Route = createFileRoute('/_authenticated/acc/beneficiarios')({
  component: AccBeneficiarios,
})
