import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcReversar } from '@/features/cxc/cxc-procesos'

export const Route = createFileRoute('/_authenticated/cxc/reversar')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcReversar noCia={noCia} punto={punto} />
}