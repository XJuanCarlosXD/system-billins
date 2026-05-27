import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcRepCobrosVendedor } from '@/features/cxc/cxc-reportes'

export const Route = createFileRoute('/_authenticated/cxc/rep-cobros-vendedor')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcRepCobrosVendedor noCia={noCia} punto={punto} />
}