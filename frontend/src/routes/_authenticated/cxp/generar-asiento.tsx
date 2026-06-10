import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpGenerarAsiento } from '@/features/cxp/cxp-procesos'

export const Route = createFileRoute('/_authenticated/cxp/generar-asiento')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpGenerarAsiento noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
