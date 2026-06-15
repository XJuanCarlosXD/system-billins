import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpEstadoCuenta } from '@/features/cxp/estado-cuenta'

export const Route = createFileRoute('/_authenticated/cxp/estado-cuenta')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpEstadoCuenta noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
