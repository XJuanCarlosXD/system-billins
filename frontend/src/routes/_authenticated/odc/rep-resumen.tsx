import { createFileRoute } from '@tanstack/react-router'
import { OdcRepResumen } from '@/features/odc/odc-rep-resumen'
export const Route = createFileRoute('/_authenticated/odc/rep-resumen')({ component: OdcRepResumen })
