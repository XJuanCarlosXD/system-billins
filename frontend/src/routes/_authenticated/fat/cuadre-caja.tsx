import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CuadreCajaFat } from '@/features/fat/cuadre-caja'

export const Route = createFileRoute('/_authenticated/fat/cuadre-caja')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CuadreCajaFat noCia={noCia} punto={punto} />
}