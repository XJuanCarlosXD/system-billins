import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { RepMargenBruto } from '@/features/fat/rep-margen-bruto'

export const Route = createFileRoute('/_authenticated/fat/rep-margen-bruto')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto = selectedPoint ?? ''
  return <RepMargenBruto noCia={noCia} punto={punto} />
}
