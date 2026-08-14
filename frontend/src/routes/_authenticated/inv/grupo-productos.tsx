import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { GruposProductos } from '@/features/inv/grupos'

export const Route = createFileRoute('/_authenticated/inv/grupo-productos')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <GruposProductos noCia={selectedCompany} punto={selectedPoint} />
}
