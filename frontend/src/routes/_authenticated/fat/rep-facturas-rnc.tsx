import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { RepFacturasRnc } from '@/features/fat/rep-facturas-rnc'

export const Route = createFileRoute('/_authenticated/fat/rep-facturas-rnc')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto = selectedPoint ?? ''
  return <RepFacturasRnc noCia={noCia} punto={punto} />
}
