import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcRepEnvejecimiento } from '@/features/cxc/cxc-reportes'

export const Route = createFileRoute('/_authenticated/cxc/rep-envejecimiento')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcRepEnvejecimiento noCia={noCia} punto={punto} />
}