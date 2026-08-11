import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpCola } from '@/features/cxp/cxp-cola'

export const Route = createFileRoute('/_authenticated/cxp/cola')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpCola noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
