import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { ConteoFisicoManual } from '@/features/inv/cf-entrada-manual'

export const Route = createFileRoute('/_authenticated/inv/entrada-cf-manual')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <ConteoFisicoManual noCia={selectedCompany} punto={selectedPoint} />
}
