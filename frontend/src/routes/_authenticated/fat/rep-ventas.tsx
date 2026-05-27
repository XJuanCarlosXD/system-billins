import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { RepVentasProducto } from '@/features/fat/rep-ventas'

export const Route = createFileRoute('/_authenticated/fat/rep-ventas')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <RepVentasProducto noCia={noCia} punto={punto} />
}