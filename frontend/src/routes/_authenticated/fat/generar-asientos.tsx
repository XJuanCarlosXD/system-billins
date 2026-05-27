import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { GenerarAsientosFat } from '@/features/fat/generar-asientos'

export const Route = createFileRoute('/_authenticated/fat/generar-asientos')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <GenerarAsientosFat noCia={noCia} punto={punto} />
}