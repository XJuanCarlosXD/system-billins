import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { TiposDocumentoFat } from '@/features/fat/tdocu'

export const Route = createFileRoute('/_authenticated/fat/tdocu')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <TiposDocumentoFat noCia={noCia} punto={punto} />
}