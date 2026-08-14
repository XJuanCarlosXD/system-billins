import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CierreEntradaDiario } from '@/features/inv/cierre-entrada-diario'

export const Route = createFileRoute('/_authenticated/inv/entrada-diario')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CierreEntradaDiario noCia={selectedCompany} punto={selectedPoint} />
}
