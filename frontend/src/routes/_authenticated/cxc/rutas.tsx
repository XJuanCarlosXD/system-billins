import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcRutas } from '@/features/cxc/cxc-catalogos'

export const Route = createFileRoute('/_authenticated/cxc/rutas')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcRutas noCia={noCia} punto={punto} />
}