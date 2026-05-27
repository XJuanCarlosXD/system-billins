import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcVendedores } from '@/features/cxc/cxc-vendedores'

export const Route = createFileRoute('/_authenticated/cxc/vendedores')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcVendedores noCia={noCia} punto={punto} />
}