import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcHistorico } from '@/features/cxc/cxc-consultas'

export const Route = createFileRoute('/_authenticated/cxc/historico')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcHistorico noCia={noCia} punto={punto} />
}