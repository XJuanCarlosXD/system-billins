import { createFileRoute } from '@tanstack/react-router'
import { OdcUsuarios } from '@/features/odc/odc-usuarios'
export const Route = createFileRoute('/_authenticated/odc/usuarios')({ component: OdcUsuarios })
