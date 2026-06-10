import { createFileRoute } from '@tanstack/react-router'
import { OdcAnular } from '@/features/odc/odc-anular'
export const Route = createFileRoute('/_authenticated/odc/anular')({ component: OdcAnular })
