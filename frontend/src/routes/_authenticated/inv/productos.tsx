import { createFileRoute } from '@tanstack/react-router'
import { CatalogoProductos } from '@/features/inv/catalogo-productos'

export const Route = createFileRoute('/_authenticated/inv/productos')({
  component: CatalogoProductos,
})
