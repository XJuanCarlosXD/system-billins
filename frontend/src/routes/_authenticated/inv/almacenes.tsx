import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { Almacenes } from '@/features/inv/almacenes'

export const Route = createFileRoute('/_authenticated/inv/almacenes')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <Almacenes noCia={selectedCompany} punto={selectedPoint} />
}
