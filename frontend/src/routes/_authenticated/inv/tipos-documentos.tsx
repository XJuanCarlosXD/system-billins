import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { TiposDocumento } from '@/features/inv/tipos-documento'

export const Route = createFileRoute('/_authenticated/inv/tipos-documentos')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <TiposDocumento noCia={selectedCompany} punto={selectedPoint} />
}
