import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcCierre } from '@/features/cxc/cxc-cierre'

export const Route = createFileRoute('/_authenticated/cxc/cierre')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcCierre noCia={noCia} punto={punto} />
}