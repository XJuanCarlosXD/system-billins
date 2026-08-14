import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { EstantesTramos } from '@/features/inv/estantes-tramos'

export const Route = createFileRoute('/_authenticated/inv/estantes-tramos')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <EstantesTramos noCia={selectedCompany} punto={selectedPoint} />
}
