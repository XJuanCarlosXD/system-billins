import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { UnidadesMedida } from '@/features/inv/unidades'

export const Route = createFileRoute('/_authenticated/inv/unidades-empaque')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <UnidadesMedida noCia={selectedCompany} punto={selectedPoint} />
}
