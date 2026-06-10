import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpBloquearPago } from '@/features/cxp/cxp-procesos'

export const Route = createFileRoute('/_authenticated/cxp/bloquear-pago')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpBloquearPago noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
