import { createFileRoute } from '@tanstack/react-router'
import { OdcRecibir } from '@/features/odc/odc-recibir'
export const Route = createFileRoute('/_authenticated/odc/recibir')({ component: OdcRecibir })
