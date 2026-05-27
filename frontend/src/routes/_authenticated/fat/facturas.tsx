import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { Facturas } from '@/features/fat/facturas'

export const Route = createFileRoute('/_authenticated/fat/facturas')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <Facturas noCia={noCia} punto={punto} />
}