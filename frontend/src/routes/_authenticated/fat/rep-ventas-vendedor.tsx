import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { RepVentasVendedor } from '@/features/fat/fat-rep-ventas-vendedor'

export const Route = createFileRoute('/_authenticated/fat/rep-ventas-vendedor')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <RepVentasVendedor noCia={noCia} punto={punto} />
}