import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { AsignarProductoAlmacen } from '@/features/inv/asignar-producto-almacen'

export const Route = createFileRoute('/_authenticated/inv/asignar-prod-cia')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <AsignarProductoAlmacen noCia={selectedCompany} punto={selectedPoint} />
}
