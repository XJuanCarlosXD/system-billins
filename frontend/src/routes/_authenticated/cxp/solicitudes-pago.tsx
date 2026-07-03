import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpSolicitudesPago } from '@/features/cxp/cxp-solicitudes'

export const Route = createFileRoute('/_authenticated/cxp/solicitudes-pago')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return (
    <CxpSolicitudesPago noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
  )
}
