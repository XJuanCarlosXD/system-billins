import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { ControlNcf } from '@/features/fat/ncf-fat'

export const Route = createFileRoute('/_authenticated/fat/ncf')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <ControlNcf noCia={noCia} punto={punto} />
}