import { createFileRoute } from '@tanstack/react-router'
import { OdcCias } from '@/features/odc/odc-cias'
export const Route = createFileRoute('/_authenticated/odc/cias')({ component: OdcCias })
