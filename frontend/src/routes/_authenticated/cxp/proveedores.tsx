import { createFileRoute } from '@tanstack/react-router'
import { CxpProveedores } from '@/features/cxp/proveedores'

export const Route = createFileRoute('/_authenticated/cxp/proveedores')({
  component: CxpProveedores,
})
