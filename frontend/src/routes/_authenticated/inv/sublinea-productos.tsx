import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { SubLineasProductos } from '@/features/inv/sublineas'

export const Route = createFileRoute('/_authenticated/inv/sublinea-productos')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <SubLineasProductos noCia={selectedCompany} punto={selectedPoint} />
}
