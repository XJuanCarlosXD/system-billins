import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CierreMensual } from '@/features/inv/cierre-mensual'

export const Route = createFileRoute('/_authenticated/inv/cierre-mensual')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CierreMensual noCia={selectedCompany} punto={selectedPoint} />
}
