import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcTransacciones } from '@/features/cxc/cxc-transacciones'

export const Route = createFileRoute('/_authenticated/cxc/transacciones')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcTransacciones noCia={noCia} punto={punto} />
}