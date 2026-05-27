import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CondicionesPago } from '@/features/fat/condiciones-pago'

export const Route = createFileRoute('/_authenticated/fat/condiciones')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CondicionesPago noCia={noCia} punto={punto} />
}