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

const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
const lastOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)

export function ChcRepDiario() {
  const { selectedCompany, selectedPoint } = useCompany()
  const today = new Date()
  const [cuentaBanco, setCuentaBanco] = useState('')
  const [tipoDocu, setTipoDocu] = useState('')
  const [status, setStatus] = useState('')
  const [desde, setDesde] = useState(firstOfMonth(today))
  const [hasta, setHasta] = useState(lastOfMonth(today))
  const [submitted, setSubmitted] = useState<{ cuentaBanco?: string; tipoDocu?: string; status?: string; desde: string; hasta: string } | null>(null)

  const cuentasQ = useQuery({
    queryKey: ['chc-cuentas-rep-diario', selectedCompany, selectedPoint],
    queryFn: () => api.chcListCuentas({ no_cia: selectedCompany, punto: selectedPoint, activa: 'S' }),
  })
  const tiposQ = useQuery({ queryKey: ['chc-tipos-docu'], queryFn: () => api.chcListTiposDocu() })

  const enabled = !!submitted
  const dataQ = useQuery<any>({
    queryKey: ['chc-rep-diario', selectedCompany, selectedPoint, submitted],
    queryFn: () => api.chcRepDiario({
      no_cia: selectedCompany, punto: selectedPoint,
      fecha_desde: submitted!.desde, fecha_hasta: submitted!.hasta,
      cuenta_banco: submitted!.cuentaBanco || undefined,
      tipo_docu: submitted!.tipoDocu || undefined,
      status: submitted!.status || undefined,
    }),
    enabled,
  })

  const generar = () => {
    if (!desde || !hasta) return
    setSubmitted({
      cuentaBanco: cuentaBanco || undefined,
      tipoDocu: tipoDocu || undefined,
      status: status || undefined,
      desde, hasta,
    })
  }

  const openPdf = () => {
    if (!enabled) return
    const params: Record<string, string> = {
      no_cia: selectedCompany, punto: selectedPoint,
      fecha_desde: submitted!.desde, fecha_hasta: submitted!.hasta,
    }
    if (submitted!.cuentaBanco) params.cuenta_banco = submitted!.cuentaBanco
    if (submitted!.tipoDocu) params.tipo_docu = submitted!.tipoDocu
    if (submitted!.status) params.status = submitted!.status
    const qs = new URLSearchParams(params).toString()
    window.open(`/print/chc-rep-diario/current?${qs}`, '_blank')
  }

  const data = dataQ.data
  const movs = data?.movimientos || []

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Libro Diario de Débito/Crédito (Rchc202/203/218/219)</h3>
        <p className="text-sm text-muted-foreground">
          Listado plano de cheques y movimientos del rango con totales por tipo. Filtra por cuenta, tipo de documento o estado.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Cuenta</Label>
          <Select value={cuentaBanco || 'all'} onValueChange={(v) => setCuentaBanco(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-56 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {(cuentasQ.data || []).map((c: any) => (
                <SelectItem key={c.cuenta_banco} value={c.cuenta_banco}>{c.cuenta_banco}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo de documento</Label>
          <Select value={tipoDocu || 'all'} onValueChange={(v) => setTipoDocu(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(tiposQ.data || []).map((t: any) => (
                <SelectItem key={t.tipo_docu} value={t.tipo_docu}>{t.tipo_docu} · {t.descri}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ambos</SelectItem>
              <SelectItem value="A">Activos</SelectItem>
              <SelectItem value="N">Nulos</SelectItem>
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
        <Button size="sm" onClick={generar} disabled={!desde || !hasta}>
          <Search className="h-4 w-4 mr-1" /> Generar
        </Button>
        <Button size="sm" variant="outline" onClick={openPdf} disabled={!enabled}>
          <FileText className="h-4 w-4 mr-1" /> Imprimir PDF
        </Button>
      </div>

      {!enabled ? (
        <div className="rounded border p-6 text-center text-sm text-muted-foreground">
          Define el rango de fechas y presiona <strong>Generar</strong>.
        </div>
      ) : dataQ.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Movimientos</CardTitle></CardHeader>
              <CardContent className="text-xl font-semibold">{data.totales.cantidad}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Activos</CardTitle></CardHeader>
              <CardContent className="text-xl font-semibold">{data.totales.activos}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Nulos</CardTitle></CardHeader>
              <CardContent className="text-xl font-semibold text-destructive">{data.totales.nulos}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Débito</CardTitle></CardHeader>
              <CardContent className="text-xl font-semibold tabular-nums text-emerald-600">+ {fmt(data.totales.total_debito)}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Crédito</CardTitle></CardHeader>
              <CardContent className="text-xl font-semibold tabular-nums text-destructive">− {fmt(data.totales.total_credito)}</CardContent></Card>
          </div>

          <div className="rounded border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Doc.</TableHead>
                  <TableHead>Beneficiario</TableHead>
                  <TableHead className="text-right">Débito</TableHead>
                  <TableHead className="text-right">Crédito</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movs.map((m: any, i: number) => (
                  <TableRow key={`${m.cuenta_banco}-${m.tipo_docu}-${m.no_docu}-${i}`} className={m.anulado ? 'opacity-60 line-through' : ''}>
                    <TableCell className="font-mono text-xs">{m.cuenta_banco}</TableCell>
                    <TableCell className="font-mono text-xs">{m.fecha}</TableCell>
                    <TableCell className="font-mono text-xs">{m.tipo_docu}-{m.no_docu}</TableCell>
                    <TableCell className="truncate max-w-sm">{m.beneficiario || m.nombre_proveedor}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(m.debito) ? fmt(m.debito) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(m.credito) ? fmt(m.credito) : '—'}</TableCell>
                    <TableCell>
                      {m.anulado ? <Badge variant="destructive">Nulo</Badge>
                        : m.conciliado === 'S' ? <Badge variant="outline">Conc</Badge>
                        : <Badge variant="secondary">Activo</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
                {movs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
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
