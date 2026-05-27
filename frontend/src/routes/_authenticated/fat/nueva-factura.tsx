import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { NuevaFactura } from '@/features/fat/fat-nueva-factura'

export const Route = createFileRoute('/_authenticated/fat/nueva-factura')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <NuevaFactura noCia={noCia} punto={punto} />
}