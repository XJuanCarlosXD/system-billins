import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpCorregirNcf } from '@/features/cxp/corregir-ncf'

export const Route = createFileRoute('/_authenticated/cxp/corregir-ncf')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpCorregirNcf noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
