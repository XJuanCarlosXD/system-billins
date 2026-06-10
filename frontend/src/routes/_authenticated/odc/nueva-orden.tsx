import { createFileRoute } from '@tanstack/react-router'
import { OdcNuevaOrden } from '@/features/odc/odc-nueva-orden'
export const Route = createFileRoute('/_authenticated/odc/nueva-orden')({ component: OdcNuevaOrden })
