import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { AnularFactura } from '@/features/fat/fat-anular-factura'

export const Route = createFileRoute('/_authenticated/fat/anular-factura')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <AnularFactura noCia={noCia} punto={punto} />
}