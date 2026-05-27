import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcGenerarAsiento } from '@/features/cxc/cxc-cierre'

export const Route = createFileRoute('/_authenticated/cxc/generar-asiento')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcGenerarAsiento noCia={noCia} punto={punto} />
}