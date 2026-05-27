import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcCiudades } from '@/features/cxc/cxc-catalogos'

export const Route = createFileRoute('/_authenticated/cxc/ciudades')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcCiudades noCia={noCia} punto={punto} />
}