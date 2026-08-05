import { createFileRoute, useSearch } from '@tanstack/react-router'
import { PrintPage } from '@/features/pdf/PrintPage'

// Todos los parámetros de búsqueda llegan como strings (o undefined). Antes se
// hacía whitelist de unas pocas keys (no_cia/punto/tipo_doc/incluir_detalle/
// hoja_por_ncf/templateDraft) y se botaba el resto -> los reportes con filtros
// (mes/ano/tipo/desde/hasta/almacen/no_produ/fecha...) nunca llegaban al backend
// (ej. inv-cierre-entrada daba "Parametros mes y ano requeridos"). Ahora se
// conservan TODOS y se reenvían a `extra`, salvo los que maneja PrintPage aparte.
type Search = Record<string, string | undefined>

// El parser de search de TanStack Router hace JSON.parse de cada valor (para
// soportar numeros/booleanos), asi que "?mes=03" puede llegar como numero 3.
// Normalizamos todo a string.
const toStr = (v: unknown): string | undefined =>
  v === undefined || v === null || v === '' ? undefined : String(v)

const RESERVED = new Set(['no_cia', 'punto', 'templateDraft'])

export const Route = createFileRoute('/print/$codigo/$id')({
  validateSearch: (s: Record<string, unknown>): Search => {
    const out: Search = {}
    for (const [k, v] of Object.entries(s)) {
      const sv = toStr(v)
      if (sv !== undefined) out[k] = sv
    }
    return out
  },
  component: _Page,
})

function _Page() {
  const { codigo, id } = Route.useParams()
  const search = useSearch({ from: '/print/$codigo/$id' }) as Search
  // Reenvía cualquier filtro (mes/ano/tipo/tipo_doc/incluir_detalle/desde/hasta/
  // almacen/no_produ/fecha...) al backend vía `extra`.
  const extra: Record<string, string> = {}
  for (const [k, v] of Object.entries(search)) {
    if (v === undefined || RESERVED.has(k)) continue
    extra[k] = v
  }
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
