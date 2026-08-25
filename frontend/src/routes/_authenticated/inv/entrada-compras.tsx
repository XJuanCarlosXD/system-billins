import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { EntradaCompras } from '@/features/inv/entrada-compras'

export const Route = createFileRoute('/_authenticated/inv/entrada-compras')({
  validateSearch: (search: Record<string, unknown>) => ({
    edit: typeof search.edit === 'string' ? search.edit : undefined,
    no_orden: typeof search.no_orden === 'string' ? search.no_orden : undefined,
  }),
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <EntradaCompras noCia={selectedCompany} punto={selectedPoint} />
}
