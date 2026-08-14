import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { ReportesParametros } from '@/features/inv/reportes-parametros'

export const Route = createFileRoute('/_authenticated/inv/lineas-sublineas')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <ReportesParametros reportType="lineas-sublineas" noCia={selectedCompany} punto={selectedPoint} />
}
