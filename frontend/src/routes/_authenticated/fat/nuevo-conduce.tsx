import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { NuevoConduce } from '@/features/fat/fat-nuevo-conduce'

export const Route = createFileRoute('/_authenticated/fat/nuevo-conduce')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <NuevoConduce noCia={noCia} punto={punto} />
}