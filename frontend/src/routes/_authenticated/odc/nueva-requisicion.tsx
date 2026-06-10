import { createFileRoute } from '@tanstack/react-router'
import { OdcNuevaRequisicion } from '@/features/odc/odc-nueva-requisicion'
export const Route = createFileRoute('/_authenticated/odc/nueva-requisicion')({ component: OdcNuevaRequisicion })
