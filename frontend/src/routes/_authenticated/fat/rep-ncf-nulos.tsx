import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { RepNcfNulos } from '@/features/fat/rep-ncf-nulos'

export const Route = createFileRoute('/_authenticated/fat/rep-ncf-nulos')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <RepNcfNulos noCia={noCia} punto={punto} />
}