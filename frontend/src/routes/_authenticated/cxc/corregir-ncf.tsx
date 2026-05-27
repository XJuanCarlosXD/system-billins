import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcCorregirNcf } from '@/features/cxc/cxc-procesos'

export const Route = createFileRoute('/_authenticated/cxc/corregir-ncf')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcCorregirNcf noCia={noCia} punto={punto} />
}