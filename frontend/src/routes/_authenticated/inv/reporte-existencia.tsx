import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { ReportesParametros } from '@/features/inv/reportes-parametros'

export const Route = createFileRoute('/_authenticated/inv/reporte-existencia')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <ReportesParametros reportType="existencia" noCia={selectedCompany} punto={selectedPoint} />
}
