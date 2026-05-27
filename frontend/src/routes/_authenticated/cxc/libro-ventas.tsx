import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcLibroVentas } from '@/features/cxc/cxc-consultas'

export const Route = createFileRoute('/_authenticated/cxc/libro-ventas')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcLibroVentas noCia={noCia} punto={punto} />
}