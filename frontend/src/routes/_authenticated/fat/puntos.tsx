import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { PuntosTrabajoFat } from '@/features/fat/puntos'

export const Route = createFileRoute('/_authenticated/fat/puntos')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <PuntosTrabajoFat noCia={noCia} punto={punto} />
}