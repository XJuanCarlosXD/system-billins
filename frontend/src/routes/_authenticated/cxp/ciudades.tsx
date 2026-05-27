import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpCiudades } from '@/features/cxp/cxp-catalogos'

export const Route = createFileRoute('/_authenticated/cxp/ciudades')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpCiudades noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
