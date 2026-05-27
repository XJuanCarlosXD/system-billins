import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcPuntos } from '@/features/cxc/cxc-catalogos'

export const Route = createFileRoute('/_authenticated/cxc/puntos')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcPuntos noCia={noCia} punto={punto} />
}