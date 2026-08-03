import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxcTransacciones } from '@/features/cxc/cxc-transacciones'

export const Route = createFileRoute('/_authenticated/cxc/transacciones')({
  validateSearch: (search: Record<string, unknown>) => ({
    pref_cliente: typeof search.pref_cliente === 'string' ? search.pref_cliente : undefined,
    pref_tipo: typeof search.pref_tipo === 'string' ? search.pref_tipo : undefined,
    pref_no: typeof search.pref_no === 'string' ? search.pref_no : undefined,
  }),
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  const { pref_cliente, pref_tipo, pref_no } = Route.useSearch()
  const prefill = pref_cliente && pref_tipo && pref_no
    ? { noCliente: pref_cliente, tipoRef: pref_tipo, noRef: pref_no }
    : undefined
  return <CxcTransacciones noCia={noCia} punto={punto} prefill={prefill} />
}