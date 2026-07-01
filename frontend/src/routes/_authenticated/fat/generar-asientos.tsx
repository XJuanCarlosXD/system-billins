import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { FatGenerarAsiento } from '@/features/fat/cierre-mensual'

export const Route = createFileRoute('/_authenticated/fat/generar-asientos')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <FatGenerarAsiento noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
