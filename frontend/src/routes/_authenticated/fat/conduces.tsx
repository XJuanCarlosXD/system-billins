import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { ConducesFat } from '@/features/fat/conduces'

export const Route = createFileRoute('/_authenticated/fat/conduces')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <ConducesFat noCia={noCia} punto={punto} />
}