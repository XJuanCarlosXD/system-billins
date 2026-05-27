import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcPagosMasivos } from '@/features/cxc/cxc-procesos'

export const Route = createFileRoute('/_authenticated/cxc/pagos-masivos')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcPagosMasivos noCia={noCia} punto={punto} />
}