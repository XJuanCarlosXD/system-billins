import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { RepVentasCliente } from '@/features/fat/fat-rep-ventas-cliente'

export const Route = createFileRoute('/_authenticated/fat/rep-ventas-cliente')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <RepVentasCliente noCia={noCia} punto={punto} />
}