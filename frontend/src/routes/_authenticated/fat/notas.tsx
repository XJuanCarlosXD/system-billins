import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { NotasFat } from '@/features/fat/fat-notas'

export const Route = createFileRoute('/_authenticated/fat/notas')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <NotasFat noCia={noCia} punto={punto} />
}