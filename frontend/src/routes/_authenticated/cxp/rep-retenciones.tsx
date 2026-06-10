import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpRepRetenciones } from '@/features/cxp/cxp-procesos'

export const Route = createFileRoute('/_authenticated/cxp/rep-retenciones')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpRepRetenciones noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
