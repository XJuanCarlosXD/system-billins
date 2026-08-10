import { createFileRoute } from '@tanstack/react-router'
import { OdcNuevaOrden } from '@/features/odc/odc-nueva-orden'

export const Route = createFileRoute('/_authenticated/odc/nueva-orden')({
  validateSearch: (search: Record<string, unknown>): { edit?: string } => ({
    edit: typeof search.edit === 'string' ? search.edit : undefined,
  }),
  component: OdcNuevaOrden,
})
