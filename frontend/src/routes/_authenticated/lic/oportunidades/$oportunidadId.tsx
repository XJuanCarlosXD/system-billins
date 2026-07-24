import { createFileRoute } from '@tanstack/react-router'
import { LicOportunidadDetalle } from '@/features/lic/lic-oportunidad-detalle'

export const Route = createFileRoute('/_authenticated/lic/oportunidades/$oportunidadId')({
  component: _Page,
})

function _Page() {
  const { oportunidadId } = Route.useParams()
  return <LicOportunidadDetalle oportunidadId={Number(oportunidadId)} />
}
