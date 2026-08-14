import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { GrupoContable } from '@/features/inv/grupo-contable'

export const Route = createFileRoute('/_authenticated/inv/grupo-contable')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <GrupoContable noCia={selectedCompany} punto={selectedPoint} />
}
