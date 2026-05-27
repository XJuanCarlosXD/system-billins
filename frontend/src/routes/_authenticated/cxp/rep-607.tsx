import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpRep607 } from '@/features/cxp/cxp-reportes'

export const Route = createFileRoute('/_authenticated/cxp/rep-607')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpRep607 noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
