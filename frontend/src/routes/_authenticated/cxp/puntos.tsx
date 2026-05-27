import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpPuntos } from '@/features/cxp/cxp-catalogos'

export const Route = createFileRoute('/_authenticated/cxp/puntos')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpPuntos noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
