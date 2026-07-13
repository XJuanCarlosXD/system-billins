import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpAplicarMovimientos } from '@/features/cxp/aplicar-movimientos'

export const Route = createFileRoute('/_authenticated/cxp/aplicar-movimientos')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpAplicarMovimientos noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
