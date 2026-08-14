import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CargarConteoExcel } from '@/features/inv/cf-cargar-excel'

export const Route = createFileRoute('/_authenticated/inv/cargar-cf-excel')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CargarConteoExcel noCia={selectedCompany} punto={selectedPoint} />
}
