import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpTproveedores } from '@/features/cxp/cxp-catalogos'

export const Route = createFileRoute('/_authenticated/cxp/tproveedores')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpTproveedores noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
