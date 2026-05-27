import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { TransportistasFat } from '@/features/fat/fat-transportistas'

export const Route = createFileRoute('/_authenticated/fat/transportistas')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <TransportistasFat noCia={noCia} punto={punto} />
}