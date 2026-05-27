import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcClientes } from '@/features/cxc/cxc-clientes'

export const Route = createFileRoute('/_authenticated/cxc/clientes')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcClientes noCia={noCia} punto={punto} />
}