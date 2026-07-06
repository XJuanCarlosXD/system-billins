import { createFileRoute, useSearch } from '@tanstack/react-router'
import { PrintPage } from '@/features/pdf/PrintPage'

type Search = {
  no_cia?: string; punto?: string; tipo_doc?: string;
  incluir_detalle?: string; templateDraft?: string;
  show_ncf_detail?: string; formas_pago_pdf?: string; cobros_cred_transfer?: string;
}

export const Route = createFileRoute('/print/$codigo/$id')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    no_cia: typeof s.no_cia === 'string' ? s.no_cia : undefined,
    punto: typeof s.punto === 'string' ? s.punto : undefined,
    tipo_doc: typeof s.tipo_doc === 'string' ? s.tipo_doc : undefined,
    incluir_detalle: typeof s.incluir_detalle === 'string' ? s.incluir_detalle : undefined,
    templateDraft: typeof s.templateDraft === 'string' ? s.templateDraft : undefined,
    show_ncf_detail: typeof s.show_ncf_detail === 'string' ? s.show_ncf_detail : undefined,
    formas_pago_pdf: typeof s.formas_pago_pdf === 'string' ? s.formas_pago_pdf : undefined,
    cobros_cred_transfer: typeof s.cobros_cred_transfer === 'string' ? s.cobros_cred_transfer : undefined,
  }),
  component: _Page,
})

function _Page() {
  const { codigo, id } = Route.useParams()
  const search = useSearch({ from: '/print/$codigo/$id' }) as Search
  const extra: Record<string, string> = {}
  if (search.tipo_doc) extra.tipo_doc = search.tipo_doc
  if (search.incluir_detalle) extra.incluir_detalle = search.incluir_detalle
  if (search.show_ncf_detail) extra.show_ncf_detail = search.show_ncf_detail
  if (search.formas_pago_pdf) extra.formas_pago_pdf = search.formas_pago_pdf
  if (search.cobros_cred_transfer) extra.cobros_cred_transfer = search.cobros_cred_transfer
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
