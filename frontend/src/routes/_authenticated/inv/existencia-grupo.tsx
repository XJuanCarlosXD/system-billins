import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { ExistenciaGrupo } from '@/features/inv/existencia-grupo'

export const Route = createFileRoute('/_authenticated/inv/existencia-grupo')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <ExistenciaGrupo noCia={selectedCompany} punto={selectedPoint} />
}
