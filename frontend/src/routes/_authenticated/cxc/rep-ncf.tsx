import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcRepNcf } from '@/features/cxc/cxc-reportes'

export const Route = createFileRoute('/_authenticated/cxc/rep-ncf')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcRepNcf noCia={noCia} punto={punto} />
}