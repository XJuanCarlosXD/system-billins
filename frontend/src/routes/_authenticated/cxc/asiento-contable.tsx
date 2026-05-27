import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcAsientoContable } from '@/features/cxc/cxc-cierre'

export const Route = createFileRoute('/_authenticated/cxc/asiento-contable')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcAsientoContable noCia={noCia} punto={punto} />
}