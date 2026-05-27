import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcSupervisores } from '@/features/cxc/cxc-catalogos'

export const Route = createFileRoute('/_authenticated/cxc/supervisores')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcSupervisores noCia={noCia} punto={punto} />
}