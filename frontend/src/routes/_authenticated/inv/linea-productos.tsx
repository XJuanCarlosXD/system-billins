import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { LineasProductos } from '@/features/inv/lineas'

export const Route = createFileRoute('/_authenticated/inv/linea-productos')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <LineasProductos noCia={selectedCompany} punto={selectedPoint} />
}
