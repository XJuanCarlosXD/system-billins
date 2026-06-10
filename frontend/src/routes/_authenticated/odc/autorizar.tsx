import { createFileRoute } from '@tanstack/react-router'
import { OdcAutorizar } from '@/features/odc/odc-autorizar'
export const Route = createFileRoute('/_authenticated/odc/autorizar')({ component: OdcAutorizar })
