import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { TransferenciaMercancia } from '@/features/inv/transferencia-mercancia'

export const Route = createFileRoute('/_authenticated/inv/transferencia-mercancia')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <TransferenciaMercancia noCia={selectedCompany} punto={selectedPoint} />
}
