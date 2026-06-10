import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpReversar } from '@/features/cxp/cxp-procesos'

export const Route = createFileRoute('/_authenticated/cxp/reversar')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpReversar noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
