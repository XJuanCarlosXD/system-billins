import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { FileText, Search } from 'lucide-react'

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const firstOfMonth = (d: Date) => {
  const r = new Date(d.getFullYear(), d.getMonth(), 1)
  return r.toISOString().slice(0, 10)
}
const lastOfMonth = (d: Date) => {
  const r = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return r.toISOString().slice(0, 10)
}

export function ChcRepMovimientos() {
  const { selectedCompany, selectedPoint } = useCompany()
  const today = new Date()
  const [cuentaBanco, setCuentaBanco] = useState('')
  const [desde, setDesde] = useState(firstOfMonth(today))
  const [hasta, setHasta] = useState(lastOfMonth(today))
  const [submitted, setSubmitted] = useState({ cuentaBanco: '', desde: '', hasta: '' })

  const cuentasQ = useQuery({
    queryKey: ['chc-cuentas-rep-mov', selectedCompany, selectedPoint],
    queryFn: () => api.chcListCuentas({ no_cia: selectedCompany, punto: selectedPoint, activa: 'S' }),
  })

  const enabled = !!submitted.cuentaBanco && !!submitted.desde && !!submitted.hasta
  const dataQ = useQuery<any>({
    queryKey: ['chc-rep-mov', selectedCompany, selectedPoint, submitted],
    queryFn: () => api.chcRepMovimientos({
      no_cia: selectedCompany, punto: selectedPoint,
      cuenta_banco: submitted.cuentaBanco,
      fecha_desde: submitted.desde, fecha_hasta: submitted.hasta,
    }),
    enabled,
  })

  const generar = () => {
    if (!cuentaBanco) return
    setSubmitted({ cuentaBanco, desde, hasta })
  }

  const openPdf = () => {
    if (!enabled) return
    const qs = new URLSearchParams({
      no_cia: selectedCompany, punto: selectedPoint,
      cuenta_banco: submitted.cuentaBanco,
      fecha_desde: submitted.desde, fecha_hasta: submitted.hasta,
    }).toString()
    window.open(`/print/chc-rep-movimientos/current?${qs}`, '_blank')
  }

  const data = dataQ.data
  const movs = data?.movimientos || []

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Movimiento de Cuenta Bancaria (Rchc501)</h3>
        <p className="text-sm text-muted-foreground">
          Detalle cronológico de débitos y créditos de una cuenta con saldo corriente.
          Saldo inicial = saldo declarado + movimientos anteriores al rango (excluye nulos).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Cuenta <span className="text-destructive">*</span></Label>
          <Select value={cuentaBanco} onValueChange={setCuentaBanco}>
            <SelectTrigger className="w-64 h-9"><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
            <SelectContent>
              {(cuentasQ.data || []).map((c: any) => (
                <SelectItem key={c.cuenta_banco} value={c.cuenta_banco}>
                  {c.cuenta_banco} · {c.moneda === 'P' ? 'DOP' : 'USD'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Desde</Label>
          <Input type="date" className="h-9 w-40" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hasta</Label>
          <Input type="date" className="h-9 w-40" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <Button size="sm" onClick={generar} disabled={!cuentaBanco}>
          <Search className="h-4 w-4 mr-1" /> Generar
        </Button>
        <Button size="sm" variant="outline" onClick={openPdf} disabled={!enabled || dataQ.isFetching}>
          <FileText className="h-4 w-4 mr-1" /> Imprimir PDF
        </Button>
      </div>

      {!enabled ? (
        <div className="rounded border p-6 text-center text-sm text-muted-foreground">
          Selecciona una cuenta y un rango de fechas, luego presiona <strong>Generar</strong>.
        </div>
      ) : dataQ.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saldo inicial</CardTitle></CardHeader>
              <CardContent className="text-xl font-semibold tabular-nums">{fmt(data.saldo_inicial)}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Débitos</CardTitle></CardHeader>
              <CardContent className="text-xl font-semibold tabular-nums text-emerald-600">+ {fmt(data.totales.total_debito)}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Créditos</CardTitle></CardHeader>
              <CardContent className="text-xl font-semibold tabular-nums text-destructive">− {fmt(data.totales.total_credito)}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saldo final</CardTitle></CardHeader>
              <CardContent className={`text-xl font-semibold tabular-nums ${Number(data.totales.saldo_final) < 0 ? 'text-destructive' : ''}`}>{fmt(data.totales.saldo_final)}</CardContent></Card>
          </div>

          <div className="rounded border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Doc.</TableHead>
                  <TableHead>Beneficiario</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="text-right">Débito</TableHead>
                  <TableHead className="text-right">Crédito</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movs.map((m: any, i: number) => (
                  <TableRow key={`${m.tipo_docu}-${m.no_docu}-${i}`} className={m.anulado ? 'opacity-60 line-through' : ''}>
                    <TableCell className="font-mono text-xs">{m.fecha}</TableCell>
                    <TableCell className="font-mono text-xs">{m.tipo_docu}-{m.no_docu}</TableCell>
                    <TableCell className="truncate max-w-xs">{m.beneficiario || m.nombre_proveedor}</TableCell>
                    <TableCell className="truncate max-w-xs text-xs text-muted-foreground">{m.detalle1}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(m.debito) ? fmt(m.debito) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(m.credito) ? fmt(m.credito) : '—'}</TableCell>
                    <TableCell className={`text-right tabular-nums ${Number(m.saldo) < 0 ? 'text-destructive' : ''}`}>{fmt(m.saldo)}</TableCell>
                    <TableCell>
                      {m.anulado ? <Badge variant="destructive">Nulo</Badge>
                        : m.conciliado === 'S' ? <Badge variant="outline">Conciliado</Badge>
                        : <Badge variant="secondary">Activo</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
                {movs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                      Sin movimientos en el rango.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
