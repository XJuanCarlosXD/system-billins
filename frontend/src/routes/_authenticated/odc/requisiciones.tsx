import { createFileRoute } from '@tanstack/react-router'
import { OdcRequisiciones } from '@/features/odc/odc-requisiciones'

export const Route = createFileRoute('/_authenticated/odc/requisiciones')({
  component: OdcRequisiciones,
})
