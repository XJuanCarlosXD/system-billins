import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CierreMensualFat } from '@/features/fat/cierre-mensual'

export const Route = createFileRoute('/_authenticated/fat/cierre-mensual')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CierreMensualFat noCia={noCia} punto={punto} />
}