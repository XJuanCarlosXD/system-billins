import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpCias } from '@/features/cxp/cxp-catalogos'

export const Route = createFileRoute('/_authenticated/cxp/cias')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpCias noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
