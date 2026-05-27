import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { Companias } from '@/features/fat/companias'

export const Route = createFileRoute('/_authenticated/fat/companias')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <Companias noCia={noCia} punto={punto} />
}