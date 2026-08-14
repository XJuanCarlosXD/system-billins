import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { ReverarDocumento } from '@/features/inv/reversar-documento'

export const Route = createFileRoute('/_authenticated/inv/reversar-documento')({
  component: Page,
})

function Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <ReverarDocumento noCia={selectedCompany} punto={selectedPoint} />
}
