import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpBarrios } from '@/features/cxp/cxp-catalogos'

export const Route = createFileRoute('/_authenticated/cxp/barrios')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpBarrios noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
