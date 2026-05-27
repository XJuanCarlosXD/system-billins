import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpPlaceholder } from '@/features/cxp/cxp-placeholder'

export const Route = createFileRoute('/_authenticated/cxp/rep-retenciones')({ 
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpPlaceholder title="rep-retenciones" noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
