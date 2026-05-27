import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcTcontable } from '@/features/cxc/cxc-catalogos'

export const Route = createFileRoute('/_authenticated/cxc/tcontable')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcTcontable noCia={noCia} punto={punto} />
}