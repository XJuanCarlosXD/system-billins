import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcBalance } from '@/features/cxc/cxc-consultas'

export const Route = createFileRoute('/_authenticated/cxc/balance')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcBalance noCia={noCia} punto={punto} />
}