import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CompaniasInv } from '@/features/inv/companias'

export const Route = createFileRoute('/_authenticated/inv/companias')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CompaniasInv noCia={selectedCompany} punto={selectedPoint} />
}
