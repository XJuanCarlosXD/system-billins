import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpRepMayor } from '@/features/cxp/cxp-reportes'

export const Route = createFileRoute('/_authenticated/cxp/rep-mayor')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpRepMayor noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
