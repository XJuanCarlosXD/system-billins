import { createFileRoute } from '@tanstack/react-router'
import { OdcPuntos } from '@/features/odc/odc-puntos'
export const Route = createFileRoute('/_authenticated/odc/puntos')({ component: OdcPuntos })
