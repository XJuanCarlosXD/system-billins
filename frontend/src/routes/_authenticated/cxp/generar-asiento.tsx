import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpPlaceholder } from '@/features/cxp/cxp-placeholder'

export const Route = createFileRoute('/_authenticated/cxp/generar-asiento')({ 
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpPlaceholder title="generar-asiento" noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
