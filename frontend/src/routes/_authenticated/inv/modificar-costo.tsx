import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { ModificarCosto } from '@/features/inv/modificar-costo'

export const Route = createFileRoute('/_authenticated/inv/modificar-costo')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <ModificarCosto noCia={selectedCompany} punto={selectedPoint} />
}
