import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcDocumentos } from '@/features/cxc/cxc-procesos'

export const Route = createFileRoute('/_authenticated/cxc/documentos')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CxcDocumentos noCia={noCia} punto={punto} />
}