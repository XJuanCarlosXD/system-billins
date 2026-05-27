import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpRepAlfabetico } from '@/features/cxp/cxp-reportes'

export const Route = createFileRoute('/_authenticated/cxp/rep-alfabetico')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpRepAlfabetico noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
