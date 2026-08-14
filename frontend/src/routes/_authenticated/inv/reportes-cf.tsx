import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { ConteoFisicoReportes } from '@/features/inv/cf-reportes'

export const Route = createFileRoute('/_authenticated/inv/reportes-cf')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <ConteoFisicoReportes noCia={selectedCompany} punto={selectedPoint} />
}
