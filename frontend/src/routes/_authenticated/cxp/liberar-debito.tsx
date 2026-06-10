import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpLiberarDebito } from '@/features/cxp/cxp-procesos'

export const Route = createFileRoute('/_authenticated/cxp/liberar-debito')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpLiberarDebito noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
