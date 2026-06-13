import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { SaldosMenoresPanel } from '@/features/_shared/saldos-menores'
import { api } from '@/lib/regal-general-api'

export const Route = createFileRoute('/_authenticated/cxp/saldos-menores')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return (
    <div className="p-6">
      <SaldosMenoresPanel
        noCia={selectedCompany ?? ''}
        punto={selectedPoint ?? ''}
        titulo="Aplicar Saldos Menores Por Ajustar"
        contextoLegacy="Equivale a Fcxp204."
        entidad="proveedor"
        fetchPreview={api.cxpGetSaldosMenores}
        fetchAplicar={api.cxpAplicarSaldosMenores}
      />
    </div>
  )
}
