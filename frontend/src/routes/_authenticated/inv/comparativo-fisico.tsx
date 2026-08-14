import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { ComparativoFisico } from '@/features/inv/cf-comparativo'

export const Route = createFileRoute('/_authenticated/inv/comparativo-fisico')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <ComparativoFisico noCia={selectedCompany} punto={selectedPoint} />
}
