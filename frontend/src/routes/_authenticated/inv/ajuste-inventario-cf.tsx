import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { AjusteConteoFisico } from '@/features/inv/cf-ajuste'

export const Route = createFileRoute('/_authenticated/inv/ajuste-inventario-cf')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <AjusteConteoFisico noCia={selectedCompany} punto={selectedPoint} />
}
