import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { RepNcf607 } from '@/features/fat/rep-607'

export const Route = createFileRoute('/_authenticated/fat/rep-607')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <RepNcf607 noCia={noCia} punto={punto} />
}