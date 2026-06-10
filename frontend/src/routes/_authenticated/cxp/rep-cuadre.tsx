import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpRepCuadre } from '@/features/cxp/cxp-procesos'

export const Route = createFileRoute('/_authenticated/cxp/rep-cuadre')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpRepCuadre noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
