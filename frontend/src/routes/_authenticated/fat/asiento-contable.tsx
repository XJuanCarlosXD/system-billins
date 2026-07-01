import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { FatAsientoContable } from '@/features/fat/cierre-mensual'

export const Route = createFileRoute('/_authenticated/fat/asiento-contable')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <FatAsientoContable noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
