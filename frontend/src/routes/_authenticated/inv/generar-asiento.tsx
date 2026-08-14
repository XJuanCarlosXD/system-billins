import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CierreAsiento } from '@/features/inv/cierre-asiento'

export const Route = createFileRoute('/_authenticated/inv/generar-asiento')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CierreAsiento noCia={selectedCompany} punto={selectedPoint} />
}
