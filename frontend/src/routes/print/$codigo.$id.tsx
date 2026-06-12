import { createFileRoute, useSearch } from '@tanstack/react-router'
import { PrintPage } from '@/features/pdf/PrintPage'

type Search = { no_cia?: string; punto?: string; tipo_doc?: string; templateDraft?: string }

export const Route = createFileRoute('/print/$codigo/$id')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    no_cia: typeof s.no_cia === 'string' ? s.no_cia : undefined,
    punto: typeof s.punto === 'string' ? s.punto : undefined,
    tipo_doc: typeof s.tipo_doc === 'string' ? s.tipo_doc : undefined,
    templateDraft: typeof s.templateDraft === 'string' ? s.templateDraft : undefined,
  }),
  component: _Page,
})

function _Page() {
  const { codigo, id } = Route.useParams()
  const search = useSearch({ from: '/print/$codigo/$id' }) as Search
  const extra: Record<string, string> = {}
  if (search.tipo_doc) extra.tipo_doc = search.tipo_doc
  return (
    <PrintPage
      codigo={codigo}
      id={id}
      no_cia={search.no_cia ?? '01'}
      punto={search.punto ?? '01'}
      extra={extra}
      noAutoPrint={search.templateDraft === '1'}
    />
  )
}
