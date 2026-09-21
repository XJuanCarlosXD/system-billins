import { createFileRoute } from '@tanstack/react-router'
import { AccNuevoEgreso } from '@/features/acc/acc-nuevo-egreso'

export const Route = createFileRoute('/_authenticated/acc/nuevo-egreso')({
  validateSearch: (search: Record<string, unknown>) => ({
    no_docu: typeof search.no_docu === 'string' ? search.no_docu
      : typeof search.no_docu === 'number' ? String(search.no_docu)
      : undefined,
  }),
  component: _Page,
})

function _Page() {
  const { no_docu } = Route.useSearch()
  return <AccNuevoEgreso editNoDocu={no_docu} />
}
