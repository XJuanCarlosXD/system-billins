import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcTcli } from '@/features/cxc/cxc-catalogos'

export const Route = createFileRoute('/_authenticated/cxc/tcli')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcTcli noCia={noCia} punto={punto} />
}