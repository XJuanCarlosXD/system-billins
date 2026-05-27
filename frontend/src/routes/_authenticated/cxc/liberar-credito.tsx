import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcLiberarCredito } from '@/features/cxc/cxc-procesos'

export const Route = createFileRoute('/_authenticated/cxc/liberar-credito')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcLiberarCredito noCia={noCia} punto={punto} />
}