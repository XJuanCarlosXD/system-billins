import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { ReportesParametros } from '@/features/inv/reportes-parametros'

export const Route = createFileRoute('/_authenticated/inv/reporte-movimientos')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <ReportesParametros reportType="movimientos" noCia={selectedCompany} punto={selectedPoint} />
}
