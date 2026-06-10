import { createFileRoute } from '@tanstack/react-router'
import { OdcRepPendientes } from '@/features/odc/odc-rep-pendientes'
export const Route = createFileRoute('/_authenticated/odc/rep-pendientes')({ component: OdcRepPendientes })
