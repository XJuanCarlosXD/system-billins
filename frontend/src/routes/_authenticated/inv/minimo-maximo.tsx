import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { MinimosMaximos } from '@/features/inv/minimos-maximos'

export const Route = createFileRoute('/_authenticated/inv/minimo-maximo')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <MinimosMaximos noCia={selectedCompany} punto={selectedPoint} />
}
