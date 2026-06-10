import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpRepMovimientos } from '@/features/cxp/cxp-procesos'

export const Route = createFileRoute('/_authenticated/cxp/rep-movimientos')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpRepMovimientos noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
