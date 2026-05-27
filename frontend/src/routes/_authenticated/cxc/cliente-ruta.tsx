import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcClienteRuta } from '@/features/cxc/cxc-procesos'

export const Route = createFileRoute('/_authenticated/cxc/cliente-ruta')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcClienteRuta noCia={noCia} punto={punto} />
}