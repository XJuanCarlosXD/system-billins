import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { TiposPagoFat } from '@/features/fat/fat-tipos-pago'

export const Route = createFileRoute('/_authenticated/fat/tipos-pago')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <TiposPagoFat noCia={noCia} punto={punto} />
}