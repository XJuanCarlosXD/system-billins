import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcTdocu } from '@/features/cxc/cxc-catalogos'

export const Route = createFileRoute('/_authenticated/cxc/tdocu')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcTdocu noCia={noCia} punto={punto} />
}