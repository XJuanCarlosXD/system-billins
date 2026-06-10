import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpUsuarios } from '@/features/cxp/cxp-usuarios'

export const Route = createFileRoute('/_authenticated/cxp/usuarios')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpUsuarios noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
