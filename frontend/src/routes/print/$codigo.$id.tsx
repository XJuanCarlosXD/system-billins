import { createFileRoute, useSearch } from '@tanstack/react-router'
import { PrintPage } from '@/features/pdf/PrintPage'

type Search = {
  no_cia?: string; punto?: string; tipo_doc?: string;
  incluir_detalle?: string; hoja_por_ncf?: string; templateDraft?: string;
}

// El parser de search de TanStack Router hace JSON.parse de cada valor
// (para soportar numeros/booleanos), asi que "?incluir_detalle=1" llega
// aqui como el NUMERO 1, no el string "1". Antes este validateSearch solo
// aceptaba typeof === 'string' y lo botaba a undefined -- por eso nunca
// llegaba al backend aunque el switch de la pantalla lo mandara bien.
const toStr = (v: unknown): string | undefined =>
  v === undefined || v === null || v === '' ? undefined : String(v)

export const Route = createFileRoute('/print/$codigo/$id')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    no_cia: toStr(s.no_cia),
    punto: toStr(s.punto),
    tipo_doc: toStr(s.tipo_doc),
    incluir_detalle: toStr(s.incluir_detalle),
    hoja_por_ncf: toStr(s.hoja_por_ncf),
    templateDraft: toStr(s.templateDraft),
  }),
  component: _Page,
})

function _Page() {
  const { codigo, id } = Route.useParams()
  const search = useSearch({ from: '/print/$codigo/$id' }) as Search
  const extra: Record<string, string> = {}
  if (search.tipo_doc) extra.tipo_doc = search.tipo_doc
  if (search.incluir_detalle) extra.incluir_detalle = search.incluir_detalle
  if (search.hoja_por_ncf) extra.hoja_por_ncf = search.hoja_por_ncf
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
