import { createFileRoute } from '@tanstack/react-router'
import { OdcOrdenes } from '@/features/odc/odc-ordenes'

export const Route = createFileRoute('/_authenticated/odc/ordenes')({
  component: OdcOrdenes,
})
