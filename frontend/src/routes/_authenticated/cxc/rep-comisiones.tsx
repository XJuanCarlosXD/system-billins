import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcRepComisiones } from '@/features/cxc/cxc-reportes'

export const Route = createFileRoute('/_authenticated/cxc/rep-comisiones')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcRepComisiones noCia={noCia} punto={punto} />
}