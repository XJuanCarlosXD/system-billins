import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { FatCierre } from '@/features/fat/cierre-mensual'

export const Route = createFileRoute('/_authenticated/fat/cierre-mensual')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <FatCierre noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
