import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { DevolucionSuplidores } from '@/features/inv/devolucion-suplidores'

export const Route = createFileRoute('/_authenticated/inv/devolucion-suplidores')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <DevolucionSuplidores noCia={selectedCompany} punto={selectedPoint} />
}
