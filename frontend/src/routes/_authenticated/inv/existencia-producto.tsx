import { createFileRoute } from '@tanstack/react-router'
import { ExistenciaProducto } from '@/features/inv/existencia-producto'

export const Route = createFileRoute('/_authenticated/inv/existencia-producto')({
  component: ExistenciaProducto,
})
