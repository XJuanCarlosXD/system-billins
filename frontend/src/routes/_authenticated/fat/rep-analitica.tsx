import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { RepAnaliticaVentas } from '@/features/fat/fat-rep-analitica'

export const Route = createFileRoute('/_authenticated/fat/rep-analitica')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <RepAnaliticaVentas noCia={noCia} punto={punto} />
}