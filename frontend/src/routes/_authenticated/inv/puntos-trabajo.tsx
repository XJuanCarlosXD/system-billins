import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { PuntosTrabajoInv } from '@/features/inv/puntos-trabajo'

export const Route = createFileRoute('/_authenticated/inv/puntos-trabajo')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <PuntosTrabajoInv noCia={selectedCompany} punto={selectedPoint} />
}
