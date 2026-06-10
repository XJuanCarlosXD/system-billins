import { createFileRoute } from '@tanstack/react-router'
import { OdcRepRequisiciones } from '@/features/odc/odc-rep-requisiciones'
export const Route = createFileRoute('/_authenticated/odc/rep-requisiciones')({ component: OdcRepRequisiciones })
