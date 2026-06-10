import { createFileRoute } from '@tanstack/react-router'
import { SdnEmpleados } from '@/features/sdn/sdn-empleados'

export const Route = createFileRoute('/_authenticated/sdn/empleados')({
  component: SdnEmpleados,
})
