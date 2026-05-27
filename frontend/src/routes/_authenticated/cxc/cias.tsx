import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcCias } from '@/features/cxc/cxc-catalogos'

export const Route = createFileRoute('/_authenticated/cxc/cias')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcCias noCia={noCia} punto={punto} />
}