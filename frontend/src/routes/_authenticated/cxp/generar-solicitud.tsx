import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpGenerarSolicitud } from '@/features/cxp/cxp-solicitudes'

export const Route = createFileRoute('/_authenticated/cxp/generar-solicitud')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return (
    <CxpGenerarSolicitud noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
  )
}
