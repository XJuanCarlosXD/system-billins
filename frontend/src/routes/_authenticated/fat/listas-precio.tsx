import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { ListasPrecioFat } from '@/features/fat/fat-listas-precio'

export const Route = createFileRoute('/_authenticated/fat/listas-precio')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <ListasPrecioFat noCia={noCia} punto={punto} />
}