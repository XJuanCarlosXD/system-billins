import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpCierre } from '@/features/cxp/cxp-procesos'

export const Route = createFileRoute('/_authenticated/cxp/cierre')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpCierre noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
