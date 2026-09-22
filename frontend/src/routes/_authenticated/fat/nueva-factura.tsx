import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { NuevaFactura } from '@/features/fat/fat-nueva-factura'

export const Route = createFileRoute('/_authenticated/fat/nueva-factura')({
  validateSearch: (search: Record<string, unknown>) => ({
    cotizacion: typeof search.cotizacion === 'string' ? search.cotizacion : undefined,
  }),
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  const { cotizacion } = Route.useSearch()
  return <NuevaFactura noCia={noCia} punto={punto} cotizacionInicial={cotizacion} />
}
