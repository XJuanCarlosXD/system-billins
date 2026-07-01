// FAT Cierre — asiento contable + generar al mayor + cierre mensual.
// Refactor al patrón CxC: React Query, PeriodoBadge, AlertIrreversible.
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Printer, ChevronRight, CheckCircle2, Lock } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { PeriodoBadge, AlertIrreversible } from '@/components/cierre'

interface P { noCia: string; punto?: string }

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function usePeriodoFat(noCia: string, punto: string) {
  return useQuery({
    queryKey: ['fat-punto', noCia, punto],
    queryFn: async () => {
      const all = await regalGeneralApi.fatListPuntos(noCia)
      return (all as any[]).find(p => String(p.punto) === String(punto)) || null
    },
    enabled: !!noCia,
  })
}

// ─── Imprimir Asiento Contable ───────────────────────────────────────────────
export function FatAsientoContable({ noCia, punto = '01' }: P) {
  const periodoQ = usePeriodoFat(noCia, punto)
  const [mesVal, setMesVal] = useState(new Date().getMonth() + 1)
  const [anoVal, setAnoVal] = useState(new Date().getFullYear())

  useMemo(() => {
    if (periodoQ.data) {
      setMesVal(periodoQ.data.mes_proceso || new Date().getMonth() + 1)
      setAnoVal(periodoQ.data.ano_proceso || new Date().getFullYear())
    }
  }, [periodoQ.data])

  const cargarMut = useMutation({
    mutationFn: () => regalGeneralApi.fatAsientoContable(noCia, punto, mesVal, anoVal),
    onError: (e: any) => toast.error(e?.detail || e?.message || 'Error al cargar el asiento'),
  })
  const rows: any[] = cargarMut.data ?? []
  const totalDebito = rows.reduce((s, r) => s + (Number(r.total_debito) || 0), 0)
  const totalCredito = rows.reduce((s, r) => s + (Number(r.total_credito) || 0), 0)
  const balanceado = Math.abs(totalDebito - totalCredito) < 0.001

  const printPdf = () => {
    if (!rows.length) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<html><head><title>Asiento Contable Facturación</title>
      <style>body{font-family:Arial,sans-serif;font-size:9pt}table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #333;padding:4px 7px}th{background:#0F172A;color:#fff}
      .r{text-align:right}.tot{font-weight:700;background:#f1f5f9}</style></head>
      <body><p><b>Asiento Contable de Facturación</b> — Empresa ${noCia} · Punto ${punto} · ${MESES[mesVal - 1]} ${anoVal}</p>
      <table><thead><tr><th>Cuenta</th><th>Centro Costo</th><th class=r>Débito</th><th class=r>Crédito</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${r.cuenta}</td><td>${r.centro_costo || ''}</td>
        <td class=r>${r.total_debito > 0 ? fmt(r.total_debito) : ''}</td>
        <td class=r>${r.total_credito > 0 ? fmt(r.total_credito) : ''}</td></tr>`).join('')}
        <tr class=tot><td colspan=2>TOTALES</td><td class=r>${fmt(totalDebito)}</td>
        <td class=r>${fmt(totalCredito)}</td></tr></tbody></table></body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 300)
  }

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Imprimir Asiento Contable</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Resumen del asiento de ventas por tipo de factura del período.
              </p>
            </div>
            <PeriodoBadge mes={periodoQ.data?.mes_proceso} ano={periodoQ.data?.ano_proceso}
                          loading={periodoQ.isLoading} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Mes</Label>
              <Select value={String(mesVal)} onValueChange={v => setMesVal(Number(v))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{i + 1} — {m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Año</Label>
              <Input type="number" min={2000} max={2099} value={anoVal}
                onChange={e => setAnoVal(Number(e.target.value))} className="h-9" />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => cargarMut.mutate()} variant="secondary"
                    disabled={cargarMut.isPending}>
              {cargarMut.isPending ? 'Cargando…' : 'Previsualizar'}
            </Button>
            <Button onClick={printPdf} disabled={!rows.length} className="gap-1">
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Previsualización</CardTitle>
              {balanceado
                ? <Badge variant="default" className="bg-green-600">Balanceado</Badge>
                : <Badge variant="destructive">Desbalanceado</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Cuenta</TableHead>
                    <TableHead className="w-32">Centro Costo</TableHead>
                    <TableHead className="w-36 text-right">Débito</TableHead>
                    <TableHead className="w-36 text-right">Crédito</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{r.cuenta}</TableCell>
                      <TableCell className="font-mono text-xs">{r.centro_costo}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.total_debito > 0 ? fmt(r.total_debito) : ''}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.total_credito > 0 ? fmt(r.total_credito) : ''}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted/60 border-t-2">
                    <TableCell colSpan={2}>TOTALES</TableCell>
                    <TableCell className="text-right tabular-nums">RD$ {fmt(totalDebito)}</TableCell>
                    <TableCell className="text-right tabular-nums">RD$ {fmt(totalCredito)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Generar Asiento al Mayor ────────────────────────────────────────────────
export function FatGenerarAsiento({ noCia, punto = '01' }: P) {
  const periodoQ = usePeriodoFat(noCia, punto)
  const [mes, setMes] = useState<number | null>(null)
  const [ano, setAno] = useState<number | null>(null)
  const [confirm, setConfirm] = useState(false)

  useMemo(() => {
    if (periodoQ.data && mes === null) {
      setMes(periodoQ.data.mes_proceso || new Date().getMonth() + 1)
      setAno(periodoQ.data.ano_proceso || new Date().getFullYear())
    }
  }, [periodoQ.data, mes])

  const pendientesQ = useQuery({
    queryKey: ['fat-pendientes', noCia, punto, mes, ano],
    queryFn: () => regalGeneralApi.fatGenerarAsientos(noCia, punto, ano!, mes!, 'preview'),
    enabled: !!noCia && !!mes && !!ano,
  })

  const generarMut = useMutation({
    mutationFn: () => regalGeneralApi.fatGenerarAsientos(noCia, punto, ano!, mes!, 'generar'),
    onSuccess: (r: any) => {
      toast.success(`Generados ${r?.generados ?? 0} asientos (${r?.errores ?? 0} errores)`)
      setConfirm(false)
      pendientesQ.refetch()
    },
    onError: (e: any) => toast.error(e?.detail || e?.message || 'Error al generar'),
  })

  const pendientes: any[] = (pendientesQ.data as any)?.items ?? []

  if (!mes || !ano) return <div className="p-6 text-muted-foreground">Cargando período…</div>

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Generar Asiento al Mayor</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Marca las facturas del período como contabilizadas.
              </p>
            </div>
            <PeriodoBadge mes={periodoQ.data?.mes_proceso} ano={periodoQ.data?.ano_proceso}
                          loading={periodoQ.isLoading} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <AlertIrreversible tone="amber">
            Esta operación marca las facturas como generadas en contabilidad y NO
            puede deshacerse. Revisa primero el asiento contable.
          </AlertIrreversible>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Mes</Label>
              <Select value={String(mes)} onValueChange={v => setMes(Number(v))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Año</Label>
              <Input type="number" min={2000} max={2099} value={ano}
                onChange={e => setAno(Number(e.target.value))} className="h-9" />
            </div>
          </div>

          <div className="border rounded-lg p-3 bg-muted/30 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Facturas pendientes de contabilizar</span>
              <Badge variant="secondary">{pendientes.length}</Badge>
            </div>
          </div>

          <Button onClick={() => setConfirm(true)} disabled={pendientes.length === 0}
                  className="w-full gap-2">
            <ChevronRight className="h-4 w-4" /> Generar Asiento
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Confirmar generación {MESES[(mes || 1) - 1]} {ano}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Se marcarán <b>{pendientes.length}</b> facturas como generadas en contabilidad.
            Operación irreversible.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>Cancelar</Button>
            <Button onClick={() => generarMut.mutate()} disabled={generarMut.isPending}>
              {generarMut.isPending ? 'Generando…' : 'Sí, generar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Cierre Mensual FAT ──────────────────────────────────────────────────────
export function FatCierre({ noCia, punto = '01' }: P) {
  const qc = useQueryClient()
  const periodoQ = usePeriodoFat(noCia, punto)
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1)
  const [ano, setAno] = useState<number>(new Date().getFullYear())
  const [confirm, setConfirm] = useState(false)

  useMemo(() => {
    if (periodoQ.data) {
      setMes(periodoQ.data.mes_proceso || new Date().getMonth() + 1)
      setAno(periodoQ.data.ano_proceso || new Date().getFullYear())
    }
  }, [periodoQ.data])

  const cierresQ = useQuery({
    queryKey: ['fat-cierres', noCia, punto],
    queryFn: () => regalGeneralApi.fatListCierres(noCia, punto),
    enabled: !!noCia,
  })

  const cerrarMut = useMutation({
    mutationFn: () => regalGeneralApi.fatCierreMensual(noCia, punto, ano, mes),
    onSuccess: () => {
      toast.success(`Cierre de ${MESES[mes - 1]} ${ano} registrado`)
      setConfirm(false)
      qc.invalidateQueries({ queryKey: ['fat-cierres'] })
    },
    onError: (e: any) => toast.error(e?.detail || e?.message || 'Error al cerrar'),
  })

  const cierres: any[] = (cierresQ.data as any)?.items ?? []
  const yaCerrado = cierres.some(r => r.ano === ano && r.mes === mes)

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Cierre Mensual de Facturación</CardTitle>
            <PeriodoBadge mes={periodoQ.data?.mes_proceso} ano={periodoQ.data?.ano_proceso}
                          loading={periodoQ.isLoading} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Registra el cierre del mes en el histórico de FAT.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <AlertIrreversible tone="red">
            <b>Operación irreversible.</b> Genera primero el asiento al mayor antes de cerrar.
          </AlertIrreversible>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Mes</Label>
              <Select value={String(mes)} onValueChange={v => setMes(Number(v))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Año</Label>
              <Input type="number" min={2000} max={2099} value={ano}
                onChange={e => setAno(Number(e.target.value))} className="h-9" />
            </div>
          </div>

          {yaCerrado && (
            <div className="rounded border border-muted bg-muted/40 px-3 py-2 text-sm flex items-center gap-2">
              <Lock className="h-4 w-4" /> {MESES[mes - 1]} {ano} ya fue cerrado.
            </div>
          )}

          <Button onClick={() => setConfirm(true)} disabled={yaCerrado}
                  variant="destructive" className="w-full gap-2">
            <Lock className="h-4 w-4" /> Cerrar {MESES[mes - 1]} {ano}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Histórico de Cierres</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20 text-center">Año</TableHead>
                <TableHead className="w-28">Mes</TableHead>
                <TableHead>Fecha Cierre</TableHead>
                <TableHead>Procesado</TableHead>
                <TableHead>Usuario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cierres.map((row, i) => (
                <TableRow key={`${row.ano}-${row.mes}-${i}`}>
                  <TableCell className="text-center font-mono">{row.ano}</TableCell>
                  <TableCell><Badge variant="secondary">{MESES[row.mes - 1]}</Badge></TableCell>
                  <TableCell className="text-sm">{row.fecha_cierre}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.fecha_sysdate}</TableCell>
                  <TableCell className="text-sm">{row.usuario}</TableCell>
                </TableRow>
              ))}
              {cierres.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sin cierres registrados.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Confirmar cierre {MESES[mes - 1]} {ano}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm">Operación irreversible.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>Cancelar</Button>
            <Button onClick={() => cerrarMut.mutate()} disabled={cerrarMut.isPending}>
              {cerrarMut.isPending ? 'Cerrando…' : 'Sí, cerrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
