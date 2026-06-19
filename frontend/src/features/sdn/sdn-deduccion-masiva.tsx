// SDN — Aplicar Deducción Masiva (AFP / SFS / ARS / ISR / etc.)
// Pre-calcula el monto por empleado del catálogo TSDN_DEDUCCIONES y permite
// insertar masivamente en TSDN_MOVIMIENTO con tipo_transaccion='D'.
import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { useEnterAdvancesFocus } from '@/hooks/use-enter-advances-focus'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Calculator, CheckCircle2, ShieldAlert } from 'lucide-react'

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function periodoAnterior(d: Date) {
  const ano = d.getFullYear()
  const mes = d.getMonth() + 1
  const dia = d.getDate()
  if (dia > 15) return { ano, mes, periodo: 1 }
  if (mes === 1) return { ano: ano - 1, mes: 12, periodo: 2 }
  return { ano, mes: mes - 1, periodo: 2 }
}

export function SdnDeduccionMasiva() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const def = periodoAnterior(new Date())

  const [nomina, setNomina] = useState('')
  const [ano, setAno] = useState(def.ano)
  const [mes, setMes] = useState(def.mes)
  const [periodo, setPeriodo] = useState(def.periodo)
  const [noDeduccion, setNoDeduccion] = useState('')
  const [preview, setPreview] = useState<any | null>(null)
  const [excluidos, setExcluidos] = useState<Set<number>>(new Set())

  const formRef = useEnterAdvancesFocus<HTMLDivElement>()

  const nominasQ = useQuery({
    queryKey: ['sdn-nominas-dedm', selectedCompany, selectedPoint],
    queryFn: () => api.sdnListNominas({
      no_cia: selectedCompany, punto: selectedPoint, estado: 'A', limit: 100,
    }),
    enabled: !!selectedCompany,
  })
  const deduccionesQ = useQuery({
    queryKey: ['sdn-deducciones-A'],
    queryFn: () => api.sdnListDeducciones('A'),
  })

  const deduccion = (deduccionesQ.data || []).find((d: any) => d.no_deduccion === noDeduccion)
  const tasa = Number(deduccion?.porciento_monto || 0)

  const calcular = useMutation({
    mutationFn: () => api.sdnAplicarDeduccionMasiva({
      no_cia: selectedCompany, punto: selectedPoint, nomina,
      ano: Number(ano), mes: Number(mes), periodo: Number(periodo),
      no_deduccion: noDeduccion, dry_run: true,
    }),
    onSuccess: (data) => { setPreview(data); setExcluidos(new Set()) },
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo calcular'),
  })

  const aplicar = useMutation({
    mutationFn: () => api.sdnAplicarDeduccionMasiva({
      no_cia: selectedCompany, punto: selectedPoint, nomina,
      ano: Number(ano), mes: Number(mes), periodo: Number(periodo),
      no_deduccion: noDeduccion,
      empleados_ids: (preview?.preview || [])
        .filter((p: any) => !excluidos.has(p.no_empleado))
        .map((p: any) => p.no_empleado),
      dry_run: false,
    }),
    onSuccess: (data) => {
      toast.success(`${data.cantidad} deducción${data.cantidad === 1 ? '' : 'es'} aplicada${data.cantidad === 1 ? '' : 's'} · RD$ ${fmt(data.total_monto)}`)
      setPreview(null); setExcluidos(new Set())
      qc.invalidateQueries({ queryKey: ['sdn-movimientos'] })
      qc.invalidateQueries({ queryKey: ['sdn-volante'] })
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo aplicar'),
  })

  const toggle = (id: number) => {
    setExcluidos((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const previewRows: any[] = preview?.preview || []
  const seleccionados = useMemo(
    () => previewRows.filter((p) => !excluidos.has(p.no_empleado)),
    [previewRows, excluidos],
  )
  const totalAplicar = useMemo(
    () => seleccionados.reduce((a, p) => a + Number(p.monto || 0), 0),
    [seleccionados],
  )

  const puedeCalcular = !!nomina && !!noDeduccion && Number(ano) > 0 && Number(mes) > 0

  return (
    <div ref={formRef} className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Aplicar Deducción Masiva (AFP / ARS / ISR…)</h3>
        <p className="text-sm text-muted-foreground">
          Calcula la deducción del catálogo <code>TSDN_DEDUCCIONES</code> para
          todos los empleados activos del período y la inserta en
          <code> TSDN_MOVIMIENTO</code>. Idempotente: salta empleados que ya
          tienen el movimiento.
        </p>
      </div>

      {/* Selectores */}
      <Card>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-4">
          <div>
            <Label className="text-xs">Nómina</Label>
            <Select value={nomina} onValueChange={setNomina}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
              <SelectContent>
                {(nominasQ.data || []).map((n: any) => (
                  <SelectItem key={n.nomina} value={n.nomina}>
                    {n.nomina} — {n.descripcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Año</Label>
            <Input type="number" className="h-9 tabular-nums" value={ano}
              onChange={(e) => setAno(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Mes</Label>
            <Input type="number" min={1} max={12} className="h-9 tabular-nums" value={mes}
              onChange={(e) => setMes(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Período</Label>
            <Select value={String(periodo)} onValueChange={(v) => setPeriodo(Number(v))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1ra quincena</SelectItem>
                <SelectItem value="2">2da quincena</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Deducción</Label>
            <Select value={noDeduccion} onValueChange={setNoDeduccion}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
              <SelectContent>
                {(deduccionesQ.data || []).map((d: any) => (
                  <SelectItem key={d.no_deduccion} value={d.no_deduccion}>
                    {d.no_deduccion} — {d.descripcion}
                    {Number(d.porciento_monto || 0) > 0 && ` (${d.porciento_monto}%)`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {deduccion && (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm flex flex-wrap items-center gap-x-6 gap-y-1">
          <span><b>Deducción:</b> {deduccion.descripcion}</span>
          {tasa > 0 && <span><b>%:</b> <span className="tabular-nums">{tasa}%</span></span>}
          {Number(deduccion.valor || 0) > 0 && (
            <span><b>Valor fijo:</b> <span className="tabular-nums">RD$ {fmt(deduccion.valor)}</span></span>
          )}
          <span><b>Origen:</b> {deduccion.empleado_patrono === 'P' ? 'Patrono' : 'Empleado'}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button onClick={() => calcular.mutate()} disabled={!puedeCalcular || calcular.isPending}>
          <Calculator className="h-4 w-4 mr-1" />
          {calcular.isPending ? 'Calculando…' : 'Calcular preview'}
        </Button>
        {preview && (
          <Button variant="default" onClick={() => aplicar.mutate()}
            disabled={seleccionados.length === 0 || aplicar.isPending}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            {aplicar.isPending
              ? 'Aplicando…'
              : `Aplicar a ${seleccionados.length} (RD$ ${fmt(totalAplicar)})`}
          </Button>
        )}
      </div>

      {/* Preview */}
      {preview && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="py-3">
              <div className="text-xs text-muted-foreground">A aplicar</div>
              <div className="text-2xl font-semibold">{previewRows.length}</div>
            </CardContent></Card>
            <Card><CardContent className="py-3">
              <div className="text-xs text-muted-foreground">Saltados</div>
              <div className="text-2xl font-semibold">{(preview.saltados || []).length}</div>
            </CardContent></Card>
            <Card><CardContent className="py-3">
              <div className="text-xs text-muted-foreground">Monto preview</div>
              <div className="text-xl font-semibold tabular-nums">RD$ {fmt(preview.total_monto)}</div>
            </CardContent></Card>
            <Card><CardContent className="py-3">
              <div className="text-xs text-muted-foreground">Seleccionados</div>
              <div className="text-xl font-semibold tabular-nums">
                {seleccionados.length} · RD$ {fmt(totalAplicar)}
              </div>
            </CardContent></Card>
          </div>

          <div className="rounded border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Empleado</TableHead>
                  <TableHead className="text-right">Salario</TableHead>
                  <TableHead className="text-right">Monto deducción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((r: any) => (
                  <TableRow key={r.no_empleado}
                    className={excluidos.has(r.no_empleado) ? 'opacity-40' : ''}>
                    <TableCell>
                      <Checkbox checked={!excluidos.has(r.no_empleado)}
                        onCheckedChange={() => toggle(r.no_empleado)} />
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {String(r.no_empleado).padStart(4, '0')}
                      </span>{' '}
                      {r.nombre_empleado}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">RD$ {fmt(r.salario)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      RD$ {fmt(r.monto)}
                    </TableCell>
                  </TableRow>
                ))}
                {previewRows.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    No hay empleados elegibles (ya tienen el movimiento o monto = 0).
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {(preview.saltados || []).length > 0 && (
            <details className="rounded border px-3 py-2 text-sm">
              <summary className="cursor-pointer flex items-center gap-2 text-muted-foreground">
                <ShieldAlert className="h-4 w-4" />
                Empleados saltados ({preview.saltados.length})
              </summary>
              <ul className="mt-2 text-xs space-y-1 pl-6">
                {preview.saltados.map((s: any) => (
                  <li key={s.no_empleado}>
                    <span className="font-mono">{String(s.no_empleado).padStart(4, '0')}</span>{' '}
                    {s.nombre_empleado} —{' '}
                    <Badge variant="outline" className="text-[10px]">{s.razon}</Badge>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
