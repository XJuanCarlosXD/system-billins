import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcBarrios } from '@/features/cxc/cxc-catalogos'

export const Route = createFileRoute('/_authenticated/cxc/barrios')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcBarrios noCia={noCia} punto={punto} />
}