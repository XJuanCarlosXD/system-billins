import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { DevolucionVentas } from '@/features/inv/devolucion-ventas'

export const Route = createFileRoute('/_authenticated/inv/devolucion-ventas')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <DevolucionVentas noCia={selectedCompany} punto={selectedPoint} />
}
