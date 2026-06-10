import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpAsientoContable } from '@/features/cxp/cxp-procesos'

export const Route = createFileRoute('/_authenticated/cxp/asiento-contable')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpAsientoContable noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
