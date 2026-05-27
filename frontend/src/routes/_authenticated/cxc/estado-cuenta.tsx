import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcEstadoCuenta } from '@/features/cxc/cxc-consultas'

export const Route = createFileRoute('/_authenticated/cxc/estado-cuenta')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcEstadoCuenta noCia={noCia} punto={punto} />
}