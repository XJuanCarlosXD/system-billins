import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv } from '@/lib/csv-utils'

interface ProvCuenta {
  no_proveedor: string; nombre: string; rnc: string
  categoria: string; clasificacion: string
  balance: number; compras_acumuladas: number; pagos_acumulados: number
  fecha_ultima_compra: string; fecha_ultimo_pago: string
}

interface Movimiento {
  tipo_docu: string; no_docu: string; tipo_movi: string
  fecha: string; cheque: number
  valor_original: number; debito: number; credito: number
}

const fmt = (n: number) => n?.toLocaleString('es-DO', { minimumFractionDigits: 2 }) ?? '0.00'
const fmtDate = (s: string) => s ? s.split('-').reverse().join('/') : '—'

function isoToday() { return new Date().toISOString().slice(0, 10) }
function isoFirstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function CxpMovimientos() {
  const { selectedCompany: noCia, selectedPoint: punto } = useCompany()
  const [input, setInput] = useState('')
  const [noProveedor, setNoProveedor] = useState('')
  const [desde, setDesde] = useState(isoFirstOfMonth())
  const [hasta, setHasta] = useState(isoToday())

  const baseParams = { no_cia: noCia || '', punto: punto || '' }

  const { data: cuenta } = useQuery<ProvCuenta>({
    queryKey: ['cxp-cuenta', noCia, punto, noProveedor],
    queryFn: () => api.cxpGetProveedorCuenta(noProveedor, baseParams),
    enabled: !!noCia && !!noProveedor,
  })

  const { data: movs = [], isLoading } = useQuery<Movimiento[]>({
    queryKey: ['cxp-movimientos', noCia, punto, noProveedor, desde, hasta],
    queryFn: () => api.cxpListMovimientosProveedor(noProveedor, { ...baseParams, desde, hasta }),
    enabled: !!noCia && !!noProveedor,
  })

  const movsConBalance = useMemo(() => {
    let bal = 0
    return movs.map(m => {
      bal += m.credito - m.debito
      return { ...m, balance: bal }
    })
  }, [movs])

  const totalDeb = movs.reduce((s, m) => s + (m.debito || 0), 0)
  const totalCred = movs.reduce((s, m) => s + (m.credito || 0), 0)

  function buscar() {
    const trimmed = input.trim()
    if (!trimmed) return
    setNoProveedor(trimmed.padStart(6, '0'))
  }

  function exportar() {
    downloadCsv(movsConBalance.map(m => ({
      'Tipo Doc': m.tipo_docu, 'No. Doc': m.no_docu, 'Tipo Mov': m.tipo_movi,
      'Fecha': fmtDate(m.fecha), 'Cheque': m.cheque || '',
      'Débito': fmt(m.debito), 'Crédito': fmt(m.credito), 'Balance': fmt(m.balance),
    })), `cxp-movimientos-${noProveedor}.csv`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <p className="text-xs text-muted-foreground mb-1">No. Proveedor</p>
          <div className="flex gap-2">
            <Input
              placeholder="000057"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buscar()}
              className="w-36"
            />
            <Button onClick={buscar} disabled={!input.trim()}>Consultar</Button>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Desde</p>
          <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="w-36" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Hasta</p>
          <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="w-36" />
        </div>
        {noProveedor && (
          <Button variant="outline" size="sm" onClick={exportar} disabled={!movs.length} className="self-end">
            Excel
          </Button>
        )}
      </div>

      {cuenta && (
        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Proveedor</p>
              <p className="font-semibold">{cuenta.no_proveedor} — {cuenta.nombre}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Clase</p>
              <p className="text-sm">{cuenta.clasificacion || cuenta.categoria || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Balance Total</p>
              <p className="font-bold text-blue-700">{fmt(cuenta.balance)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Compras Acum.</p>
              <p className="text-sm">{fmt(cuenta.compras_acumuladas)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pagos Acum.</p>
              <p className="text-sm">{fmt(cuenta.pagos_acumulados)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ú. Compra / Ú. Pago</p>
              <p className="text-sm">{fmtDate(cuenta.fecha_ultima_compra)} / {fmtDate(cuenta.fecha_ultimo_pago)}</p>
            </div>
          </div>
        </div>
      )}

      {noProveedor && (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>No. Doc</TableHead>
                <TableHead>Mov</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Cheque</TableHead>
                <TableHead className="text-right">Débito</TableHead>
                <TableHead className="text-right">Crédito</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Cargando…</TableCell></TableRow>
              )}
              {!isLoading && movsConBalance.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Sin movimientos en el período seleccionado</TableCell></TableRow>
              )}
              {movsConBalance.map(m => (
                <TableRow key={`${m.tipo_docu}-${m.no_docu}`} className="text-sm">
                  <TableCell>
                    <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{m.tipo_docu}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{m.no_docu}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      m.tipo_movi === 'Credito' ? 'border-blue-300 text-blue-700' : 'border-orange-300 text-orange-700'
                    }>
                      {m.tipo_movi === 'Credito' ? 'Crédito' : m.tipo_movi === 'Debito' ? 'Débito' : m.tipo_movi}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{fmtDate(m.fecha)}</TableCell>
                  <TableCell className="text-right text-xs font-mono">{m.cheque > 0 ? m.cheque : ''}</TableCell>
                  <TableCell className="text-right">{m.debito > 0 ? fmt(m.debito) : ''}</TableCell>
                  <TableCell className="text-right">{m.credito > 0 ? fmt(m.credito) : ''}</TableCell>
                  <TableCell className={`text-right font-medium ${m.balance > 0 ? 'text-blue-700' : m.balance < 0 ? 'text-green-700' : ''}`}>
                    {fmt(Math.abs(m.balance))}
                  </TableCell>
                </TableRow>
              ))}
              {movsConBalance.length > 0 && (
                <TableRow className="bg-muted/50 font-semibold border-t-2">
                  <TableCell colSpan={5} className="text-right text-sm">Totales período:</TableCell>
                  <TableCell className="text-right">{fmt(totalDeb)}</TableCell>
                  <TableCell className="text-right">{fmt(totalCred)}</TableCell>
                  <TableCell className="text-right font-bold">{fmt(Math.abs(totalCred - totalDeb))}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {!noProveedor && (
        <div className="text-center text-muted-foreground py-16">
          <p className="text-base font-medium">Movimientos de Proveedores</p>
          <p className="text-sm mt-1">Ingrese el número de proveedor para ver el historial de movimientos</p>
        </div>
      )}
    </div>
  )
}
