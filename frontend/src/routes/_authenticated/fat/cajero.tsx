import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CajeroFat } from '@/features/fat/fat-cajero'

export const Route = createFileRoute('/_authenticated/fat/cajero')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CajeroFat noCia={noCia} punto={punto} />
}
