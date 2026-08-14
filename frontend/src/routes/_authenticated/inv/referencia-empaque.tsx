import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { ReferenciaEmpaque } from '@/features/inv/referencia-empaque'

export const Route = createFileRoute('/_authenticated/inv/referencia-empaque')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <ReferenciaEmpaque noCia={selectedCompany} punto={selectedPoint} />
}
