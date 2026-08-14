import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { SalidaMercancia } from '@/features/inv/salida-mercancia'

export const Route = createFileRoute('/_authenticated/inv/salida-mercancia')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <SalidaMercancia noCia={selectedCompany} punto={selectedPoint} />
}
