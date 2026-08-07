// CxC Cierre — asiento contable + generar al mayor + cierre de período
// Refactor 2026-06-11: noCia/punto desde useCompany (no editables), React Query,
// período activo legible, validaciones, prints inline. Sin códigos legacy en títulos.
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Printer, ChevronRight, CheckCircle2, AlertTriangle, Calendar } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { buildReportMeta } from '../cnt/export-utils'
import { GuardedButton } from '@/components/access'

interface P { noCia: string; punto?: string; mes?: number; ano?: number }

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// Hook compartido: lee el período activo de TCXC_PUNTO.
function usePeriodoCxC(noCia: string, punto: string) {
  return useQuery({
    queryKey: ['cxc-punto', noCia, punto],
    queryFn: async () => {
      const all = await regalGeneralApi.cxcListPuntos(noCia)
      return (all as any[]).find(p => String(p.punto) === String(punto)) || null
    },
    enabled: !!noCia,
  })
}

function PeriodoBadge({ noCia, punto }: { noCia: string; punto: string }) {
  const q = usePeriodoCxC(noCia, punto)
  if (!q.data) return null
  return (
    <Badge variant="outline" className="text-xs">
      <Calendar className="h-3 w-3 mr-1" />
      Período activo: <span className="font-semibold ml-1">
        {MESES[(q.data.mes_proceso || 1) - 1]} {q.data.ano_proceso}
      </span>
    </Badge>
  )
}

// ─── Imprimir Asiento Contable (RCXC301 — vista del asiento por cuenta) ──────
export function CxcAsientoContable({ noCia, punto = '01', mes, ano }: P) {
  const periodoQ = usePeriodoCxC(noCia, punto)
  const [mesVal, setMesVal] = useState(mes || new Date().getMonth() + 1)
  const [anoVal, setAnoVal] = useState(ano || new Date().getFullYear())
  const [tipoImpresion, setTipoImpresion] = useState<'detallado' | 'diario'>('detallado')

  // Sincronizar con período activo cuando llega
  useMemo(() => {
    if (periodoQ.data && !mes && !ano) {
      setMesVal(periodoQ.data.mes_proceso || 1)
      setAnoVal(periodoQ.data.ano_proceso || new Date().getFullYear())
    }
  }, [periodoQ.data, mes, ano])

  const cargarMut = useMutation({
    mutationFn: () => regalGeneralApi.cxcAsientoContable(noCia, punto, mesVal, anoVal),
  })
  const rows: any[] = cargarMut.data ?? []
  const totalDebito = rows.reduce((s, r) => s + (r.total_debito || 0), 0)
  const totalCredito = rows.reduce((s, r) => s + (r.total_credito || 0), 0)
  const balanceado = Math.abs(totalDebito - totalCredito) < 0.001

  const printPdf = () => {
    if (!rows.length) return
    // Print fino vía el sistema de plantillas Puck (código cxc-asiento).
    const qs = new URLSearchParams({
      no_cia: noCia, punto, mes: String(mesVal), ano: String(anoVal), tipo: tipoImpresion,
    }).toString()
    window.open(`/print/cxc-asiento/current?${qs}`, '_blank')
  }

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Imprimir Asiento Contable</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Resumen del asiento por cuenta del período seleccionado.
              </p>
            </div>
            <PeriodoBadge noCia={noCia} punto={punto} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
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
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de impresión</Label>
              <Select value={tipoImpresion} onValueChange={v => setTipoImpresion(v as any)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="detallado">Soporte detallado</SelectItem>
                  <SelectItem value="diario">Entrada de diario</SelectItem>
                </SelectContent>
              </Select>
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

// ─── Generar Asiento al Mayor (FCXC402) ─────────────────────────────────────
export function CxcGenerarAsiento({ noCia, punto = '01' }: P) {
  const periodoQ = usePeriodoCxC(noCia, punto)
  const [mesProceso, setMesProceso] = useState<number | null>(null)
  const [anoProceso, setAnoProceso] = useState<number | null>(null)
  const [mesConta, setMesConta] = useState<number | null>(null)
  const [anoConta, setAnoConta] = useState<number | null>(null)
  const [cierreFiscal, setCierreFiscal] = useState(false)
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))

  useMemo(() => {
    if (periodoQ.data && mesProceso === null) {
      setMesProceso(periodoQ.data.mes_proceso || 1)
      setAnoProceso(periodoQ.data.ano_proceso || new Date().getFullYear())
      setMesConta(periodoQ.data.mes_proceso || 1)
      setAnoConta(periodoQ.data.ano_proceso || new Date().getFullYear())
    }
  }, [periodoQ.data, mesProceso])

  const generarMut = useMutation({
    mutationFn: () => regalGeneralApi.cxcGenerarAsiento({
      no_cia: noCia, punto,
      mes_proceso: mesProceso!, ano_proceso: anoProceso!,
      cierre_fiscal: cierreFiscal,
    } as any),
    onSuccess: () => toast.success(`Asiento generado para ${String(mesProceso).padStart(2, '0')}/${anoProceso}`),
    onError: (e: Error) => toast.error(e.message || 'Error al generar el asiento'),
  })

  const ejecutar = () => {
    if (!confirm('¿Generar asiento al mayor? Esta operación es irreversible.')) return
    generarMut.mutate()
  }

  if (!mesProceso) return <div className="p-6 text-muted-foreground">Cargando período…</div>

  return (
    <div className="p-6 space-y-4 max-w-2xl mx-auto">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Generar Asiento al Mayor</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Marca todos los documentos del mes como contabilizados y los envía a Contabilidad.
              </p>
            </div>
            <PeriodoBadge noCia={noCia} punto={punto} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border border-amber-300 bg-amber-50 rounded-lg p-3 text-sm text-amber-900 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              Esta operación marca los documentos como generados en contabilidad y NO puede deshacerse.
              Asegúrese de haber revisado el asiento contable previamente.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Período de Proceso</Label>
              <div className="flex gap-2">
                <Select value={String(mesProceso)} onValueChange={v => setMesProceso(Number(v))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" min={2000} max={2099} value={anoProceso || ''}
                  onChange={e => setAnoProceso(Number(e.target.value))} className="h-9 w-24" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Período Contabilidad</Label>
              <div className="flex gap-2">
                <Select value={String(mesConta)} onValueChange={v => setMesConta(Number(v))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" min={2000} max={2099} value={anoConta || ''}
                  onChange={e => setAnoConta(Number(e.target.value))} className="h-9 w-24" />
              </div>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Fecha del Asiento</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="h-9" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">¿Es cierre fiscal?</Label>
            <Select value={cierreFiscal ? 'S' : 'N'} onValueChange={v => setCierreFiscal(v === 'S')}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="N">No — Cierre mensual normal</SelectItem>
                <SelectItem value="S">Sí — Cierre del año fiscal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={ejecutar} disabled={generarMut.isPending} className="w-full gap-2">
            <ChevronRight className="h-4 w-4" />
            {generarMut.isPending ? 'Generando…' : 'Generar Asiento'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Cierre de CxC (FCXC403) ────────────────────────────────────────────────
export function CxcCierre({ noCia, punto = '01' }: P) {
  const qc = useQueryClient()
  const periodoQ = usePeriodoCxC(noCia, punto)
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))

  // Historial de periodos con asiento ya generado (derivado de
  // TCXC_DOCUMENTO.st_generado_cnt='S'). CxC no tiene tabla propia de cierres.
  const asientosQ = useQuery({
    queryKey: ['cxc-asientos-generados', noCia, punto],
    queryFn: () => regalGeneralApi.cxcAsientosGenerados(noCia, punto),
    enabled: !!noCia,
  })
  const asientos: any[] = (asientosQ.data as any[]) ?? []

  const cerrarMut = useMutation({
    mutationFn: () => regalGeneralApi.cxcCierre({ no_cia: noCia, punto } as any),
    onSuccess: (r: any) => {
      const m = MESES[(r?.mes || 1) - 1]
      toast.success(`Cierre ejecutado. Nuevo período: ${m} ${r?.ano || ''}`)
      qc.invalidateQueries({ queryKey: ['cxc-punto', noCia, punto] })
      qc.invalidateQueries({ queryKey: ['cxc-asientos-generados', noCia, punto] })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al ejecutar el cierre'),
  })

  const ejecutar = () => {
    if (!periodoQ.data) return
    const m = MESES[(periodoQ.data.mes_proceso || 1) - 1]
    if (!confirm(`¿Ejecutar cierre de CxC para ${m} ${periodoQ.data.ano_proceso}?\n\nEsta operación avanzará el período y NO puede deshacerse.`)) return
    cerrarMut.mutate()
  }

  const fmtDate = (s: any) => s ? String(s).slice(0, 10) : '—'
  const isBalanced = (r: any) => Math.abs(Number(r.total_debito || 0) - Number(r.total_credito || 0)) < 0.005

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <Card className="max-w-xl mx-auto">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Cierre Mensual de Cuentas por Cobrar</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Avanza el período activo del módulo al siguiente mes.
              </p>
            </div>
            <PeriodoBadge noCia={noCia} punto={punto} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border border-red-300 bg-red-50 rounded-lg p-3 text-sm text-red-900 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <b>Operación irreversible.</b> Asegúrese de haber generado el asiento contable
              y revisado los reportes del período antes de continuar.
            </div>
          </div>

          {periodoQ.data && (
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between p-3 border rounded bg-muted/40">
                <span className="text-sm text-muted-foreground">Período actual</span>
                <span className="font-semibold">
                  {MESES[(periodoQ.data.mes_proceso || 1) - 1]} {periodoQ.data.ano_proceso}
                </span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha del cierre</Label>
                <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="h-9" />
              </div>
            </div>
          )}

          {cerrarMut.isSuccess && (
            <div className="bg-green-50 border border-green-300 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div className="text-sm text-green-800">
                Cierre completado. El nuevo período es{' '}
                <b>{MESES[((cerrarMut.data as any)?.mes || 1) - 1]} {(cerrarMut.data as any)?.ano}</b>
              </div>
            </div>
          )}

          <GuardedButton modulo="cxc" flag="HACER_CIERRE"
                  onClick={ejecutar} disabled={cerrarMut.isPending || !periodoQ.data}
                  variant="destructive" className="w-full gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {cerrarMut.isPending ? 'Procesando…' : 'Ejecutar Cierre'}
          </GuardedButton>
        </CardContent>
      </Card>

      {/* Historial de asientos generados — derivado de TCXC_DOCUMENTO.st_generado_cnt='S'. */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Asientos generados</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Períodos con asiento contable ya enviado al mayor.
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              {asientos.length} período{asientos.length === 1 ? '' : 's'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-24">Año</TableHead>
                <TableHead className="w-32">Mes</TableHead>
                <TableHead className="w-28 text-center">Documentos</TableHead>
                <TableHead className="text-right">Débito</TableHead>
                <TableHead className="text-right">Crédito</TableHead>
                <TableHead className="w-28 text-center">Estado</TableHead>
                <TableHead className="w-32">Rango fechas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {asientosQ.isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              )}
              {!asientosQ.isLoading && asientos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                    Aún no hay períodos con asiento generado para esta empresa y punto.
                  </TableCell>
                </TableRow>
              )}
              {asientos.map((r, i) => (
                <TableRow key={`${r.ano}-${r.mes}-${i}`}>
                  <TableCell className="font-mono">{r.ano}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {String(r.mes).padStart(2, '0')} · {MESES[Number(r.mes) - 1]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-mono tabular-nums">
                    {r.documentos}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.total_debito)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.total_credito)}</TableCell>
                  <TableCell className="text-center">
                    {isBalanced(r)
                      ? <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px]">Balanceado</Badge>
                      : <Badge variant="destructive" className="text-[10px]">Desbalanceado</Badge>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmtDate(r.fecha_desde)}
                    {r.fecha_desde && r.fecha_hasta ? ' → ' : ''}
                    {fmtDate(r.fecha_hasta)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
