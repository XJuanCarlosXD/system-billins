import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcCadenas } from '@/features/cxc/cxc-catalogos'

export const Route = createFileRoute('/_authenticated/cxc/cadenas')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcCadenas noCia={noCia} punto={punto} />
}
