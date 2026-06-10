import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpEntradaDocumentos } from '@/features/cxp/cxp-procesos'

export const Route = createFileRoute('/_authenticated/cxp/entrada-documentos')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpEntradaDocumentos noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
