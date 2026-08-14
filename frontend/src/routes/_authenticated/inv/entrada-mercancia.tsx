import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { EntradaMercancia } from '@/features/inv/entrada-mercancia'

export const Route = createFileRoute('/_authenticated/inv/entrada-mercancia')({
  validateSearch: (search: Record<string, unknown>) => ({
    edit: typeof search.edit === 'string' ? search.edit : undefined,
  }),
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <EntradaMercancia noCia={selectedCompany} punto={selectedPoint} tipoMov="entrada" />
}
