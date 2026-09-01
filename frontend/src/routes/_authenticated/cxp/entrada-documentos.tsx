import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpEntradaDocumentos } from '@/features/cxp/cxp-procesos'

export const Route = createFileRoute('/_authenticated/cxp/entrada-documentos')({
  validateSearch: (search: Record<string, unknown>) => {
    // TanStack Router's default search parser applies JSON.parse to each value,
    // so ?cola_id=81 llega como number 81 (no string) y ?tipo=FP como string.
    // Aceptar ambos y descartar valores no numericos para cola_id.
    const colaRaw = search.cola_id
    const colaNum = typeof colaRaw === 'number' ? colaRaw
      : typeof colaRaw === 'string' && colaRaw ? Number(colaRaw)
      : NaN
    return {
      tipo: typeof search.tipo === 'string' ? search.tipo : undefined,
      no_docu: typeof search.no_docu === 'string' ? search.no_docu
        : typeof search.no_docu === 'number' ? String(search.no_docu)
        : undefined,
      cola_id: Number.isFinite(colaNum) ? colaNum : undefined,
    }
  },
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const { tipo, no_docu, cola_id } = Route.useSearch()
  return (
    <CxpEntradaDocumentos
      noCia={selectedCompany ?? ''}
      punto={selectedPoint ?? ''}
      editTipo={tipo}
      editNoDocu={no_docu}
      editColaId={cola_id}
    />
  )
}
