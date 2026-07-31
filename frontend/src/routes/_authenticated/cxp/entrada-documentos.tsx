import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpEntradaDocumentos } from '@/features/cxp/cxp-procesos'

export const Route = createFileRoute('/_authenticated/cxp/entrada-documentos')({
  validateSearch: (search: Record<string, unknown>) => ({
    tipo: typeof search.tipo === 'string' ? search.tipo : undefined,
    no_docu: typeof search.no_docu === 'string' ? search.no_docu : undefined,
  }),
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const { tipo, no_docu } = Route.useSearch()
  return (
    <CxpEntradaDocumentos
      noCia={selectedCompany ?? ''}
      punto={selectedPoint ?? ''}
      editTipo={tipo}
      editNoDocu={no_docu}
    />
  )
}
