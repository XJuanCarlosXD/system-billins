import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpTdocu } from '@/features/cxp/cxp-catalogos'

export const Route = createFileRoute('/_authenticated/cxp/tdocu')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpTdocu noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
