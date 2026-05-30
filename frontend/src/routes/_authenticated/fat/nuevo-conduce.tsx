import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { NuevoConduce } from '@/features/fat/fat-nuevo-conduce'

export const Route = createFileRoute('/_authenticated/fat/nuevo-conduce')({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === 'string' ? search.id : undefined,
    tipo: typeof search.tipo === 'string' ? search.tipo : undefined,
  }),
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  const { id, tipo } = Route.useSearch()
  return <NuevoConduce noCia={noCia} punto={punto} editId={id} editTipo={tipo} />
}
