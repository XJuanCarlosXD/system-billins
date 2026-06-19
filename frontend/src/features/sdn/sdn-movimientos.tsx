// SDN — Movimientos Manuales (Fsdn204 / Fsdn205).
// Permite registrar ingresos y deducciones individuales por empleado para una
// nómina/período abierto. Inserta en SDN.TSDN_MOVIMIENTO con ORIGEN='M'
// y reabre el cálculo de la nómina (CALCULO_NOMINA='N').
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

const fmt = (n: number) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const periodoLabel = (p: number) =>
  p === 1 ? 'P1 (1ra quincena)' : p === 2 ? 'P2 (2da quincena)' : `P${p}`

// Default al período inmediatamente anterior — donde típicamente ya existen
// movimientos. Si hoy estamos después del 15 → 1ra quincena del mes actual.
// Si estamos del 1 al 15 → 2da quincena del mes anterior.
function periodoAnterior(d: Date) {
  const ano = d.getFullYear()
  const mes = d.getMonth() + 1
  const dia = d.getDate()
  if (dia > 15) return { ano, mes, periodo: 1 }
  if (mes === 1) return { ano: ano - 1, mes: 12, periodo: 2 }
  return { ano, mes: mes - 1, periodo: 2 }
}

export function SdnMovimientos() {
  const { selectedCompany, selectedPoint } = useCompany()
  const qc = useQueryClient()
  const def = periodoAnterior(new Date())
  const [f, setF] = useState({
    nomina: '',
    ano: def.ano,
    mes: def.mes,
    periodo: def.periodo,
    no_empleado: '',
  })
  const [dlg, setDlg] = useState(false)
  const [form, setForm] = useState({
    no_empleado: '',
    tipo_transaccion: 'I' as 'I' | 'D',
    no_transaccion: '',
    monto: '',
  })

  const nominas = useQuery({
    queryKey: ['sdn-nominas-filter', selectedCompany, selectedPoint],
    queryFn: () => api.sdnListNominas({
      no_cia: selectedCompany, punto: selectedPoint, estado: 'A', limit: 100,
    }),
    enabled: !!selectedCompany,
  })

  const ingresos = useQuery({
    queryKey: ['sdn-ingresos-act'],
    queryFn: () => api.sdnListIngresos('A'),
  })
  const deducciones = useQuery({
    queryKey: ['sdn-deducciones-act'],
    queryFn: () => api.sdnListDeducciones('A'),
  })

  const movs = useQuery({
    queryKey: ['sdn-movimientos', selectedCompany, selectedPoint, f],
    queryFn: () => api.sdnListMovimientos({
      no_cia: selectedCompany, punto: selectedPoint,
      nomina: f.nomina, ano: f.ano, mes: f.mes, periodo: f.periodo,
      no_empleado: f.no_empleado ? Number(f.no_empleado) : undefined,
    }),
    enabled: !!f.nomina && !!f.ano && !!f.mes,
  })

  const create = useMutation({
    mutationFn: () => api.sdnCrearMovimiento({
      no_cia: selectedCompany, punto: selectedPoint,
      nomina: f.nomina, ano: f.ano, mes: f.mes, periodo: f.periodo,
      no_empleado: Number(form.no_empleado),
      tipo_transaccion: form.tipo_transaccion,
      no_transaccion: form.no_transaccion,
      monto: Number(form.monto),
    }),
    onSuccess: () => {
      toast.success('Movimiento manual registrado — nómina reabierta para recálculo')
      qc.invalidateQueries({ queryKey: ['sdn-movimientos'] })
      qc.invalidateQueries({ queryKey: ['sdn-nominas'] })
      setDlg(false)
      setForm({ no_empleado: '', tipo_transaccion: 'I', no_transaccion: '', monto: '' })
    },
    onError: (e: any) =>
      toast.error(e?.detail?.error || e?.message || 'No se pudo registrar el movimiento'),
  })

  const remove = useMutation({
    mutationFn: (row: any) => api.sdnEliminarMovimiento({
      no_cia: selectedCompany, punto: selectedPoint,
      nomina: f.nomina, ano: f.ano, mes: f.mes, periodo: f.periodo,
      no_empleado: row.no_empleado, linea: row.linea,
    }),
    onSuccess: () => {
      toast.success('Movimiento eliminado')
      qc.invalidateQueries({ queryKey: ['sdn-movimientos'] })
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo eliminar'),
  })

  const rows = movs.data || []
  const totIng = rows.filter((r: any) => r.tipo_transaccion === 'I')
    .reduce((s: number, r: any) => s + Number(r.monto_transaccion || 0), 0)
  const totDed = rows.filter((r: any) => r.tipo_transaccion === 'D')
    .reduce((s: number, r: any) => s + Number(r.monto_transaccion || 0), 0)

  const opcionesConcepto = form.tipo_transaccion === 'I' ? ingresos.data || [] : deducciones.data || []
  const conceptoKey = form.tipo_transaccion === 'I' ? 'no_ingreso' : 'no_deduccion'
  const required = form.no_empleado && form.no_transaccion && form.monto && Number(form.monto) > 0

  if (!selectedCompany) {
    return <p className="text-muted-foreground py-8 text-center">Seleccione una empresa para registrar movimientos.</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Movimientos Manuales de Nómina</h3>
        <p className="text-sm text-muted-foreground">
          Ingresos y deducciones individuales por empleado para una nómina abierta.
          Equivale a <i>Fsdn204 / Fsdn205</i> · tabla <code>SDN.TSDN_MOVIMIENTO</code> (origen <code>M</code>).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded border bg-muted/30 p-3">
        <div>
          <Label className="text-xs">Nómina</Label>
          <select
            className="border rounded px-3 py-2 text-sm h-9 min-w-[180px] bg-background"
            value={f.nomina}
            onChange={(e) => setF({ ...f, nomina: e.target.value })}
          >
            <option value="">— seleccione —</option>
            {(nominas.data || []).map((n: any) => (
              <option key={`${n.nomina}-${n.ano_proceso}-${n.mes_proceso}-${n.periodo}`} value={n.nomina}>
                {n.nomina} — {n.descripcion} · {String(n.mes_proceso).padStart(2, '0')}/{n.ano_proceso}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Año</Label>
          <Input className="w-24 h-9" type="number" value={f.ano}
            onChange={(e) => setF({ ...f, ano: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Mes</Label>
          <Input className="w-20 h-9" type="number" min={1} max={12} value={f.mes}
            onChange={(e) => setF({ ...f, mes: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Período</Label>
          <select
            className="border rounded px-3 py-2 text-sm h-9 bg-background"
            value={f.periodo}
            onChange={(e) => setF({ ...f, periodo: Number(e.target.value) })}
          >
            <option value={1}>P1</option>
            <option value={2}>P2</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">Empleado #</Label>
          <Input className="w-28 h-9" type="number" value={f.no_empleado}
            onChange={(e) => setF({ ...f, no_empleado: e.target.value })}
            placeholder="opcional" />
        </div>
        <Button size="sm" variant="outline" onClick={() => movs.refetch()} disabled={!f.nomina}>
          <Search className="h-4 w-4 mr-1" /> Buscar
        </Button>
        <Button size="sm" className="ml-auto" disabled={!f.nomina}
          onClick={() => { setForm({ no_empleado: f.no_empleado, tipo_transaccion: 'I', no_transaccion: '', monto: '' }); setDlg(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo movimiento
        </Button>
      </div>

      <div className="flex gap-2 text-xs">
        <Badge variant="secondary">Período: {periodoLabel(f.periodo)}</Badge>
        {rows.length > 0 && (
          <>
            <Badge>Ingresos: RD$ {fmt(totIng)}</Badge>
            <Badge variant="outline">Deducciones: RD$ {fmt(totDed)}</Badge>
            <Badge variant="outline">Neto del período: RD$ {fmt(totIng - totDed)}</Badge>
          </>
        )}
      </div>

      {movs.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="rounded border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Empleado</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="w-16">Tipo</TableHead>
                <TableHead className="w-20">Concepto</TableHead>
                <TableHead>Descripción concepto</TableHead>
                <TableHead className="w-20">Origen</TableHead>
                <TableHead className="w-28">Fecha</TableHead>
                <TableHead className="w-32 text-right">Monto (RD$)</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={`${r.no_empleado}-${r.linea}-${r.tipo_transaccion}-${r.no_transaccion}`}>
                  <TableCell className="font-mono">{r.no_empleado}</TableCell>
                  <TableCell className="max-w-[220px] truncate" title={r.nombre_empleado}>{r.nombre_empleado}</TableCell>
                  <TableCell>
                    <Badge variant={r.tipo_transaccion === 'I' ? 'default' : 'destructive'} className="text-xs">
                      {r.tipo_transaccion === 'I' ? 'Ingreso' : 'Deducción'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{r.no_transaccion}</TableCell>
                  <TableCell className="text-xs">{r.descri_concepto || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {r.origen === 'M' ? 'Manual' : r.origen === 'N' ? 'Normal' : r.origen === 'V' ? 'Vac.' : r.origen}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{r.fecha}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{fmt(r.monto_transaccion)}</TableCell>
                  <TableCell>
                    {r.origen === 'M' && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={() => {
                          if (confirm(`¿Eliminar movimiento de ${r.nombre_empleado} (RD$ ${fmt(r.monto_transaccion)})?`)) {
                            remove.mutate(r)
                          }
                        }}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!movs.isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                    {f.nomina
                      ? 'Sin movimientos para los filtros actuales.'
                      : 'Seleccione una nómina para ver sus movimientos.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dlg} onOpenChange={setDlg}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo movimiento manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <Label className="text-xs">Empleado # <span className="text-destructive">*</span></Label>
              <Input type="number" value={form.no_empleado}
                onChange={(e) => setForm({ ...form, no_empleado: e.target.value })}
                placeholder="No. empleado" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Tipo <span className="text-destructive">*</span></Label>
                <select
                  className="border rounded px-3 py-2 text-sm h-9 w-full bg-background"
                  value={form.tipo_transaccion}
                  onChange={(e) => setForm({ ...form, tipo_transaccion: e.target.value as 'I' | 'D', no_transaccion: '' })}
                >
                  <option value="I">Ingreso</option>
                  <option value="D">Deducción</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Concepto <span className="text-destructive">*</span></Label>
                <select
                  className="border rounded px-3 py-2 text-sm h-9 w-full bg-background"
                  value={form.no_transaccion}
                  onChange={(e) => setForm({ ...form, no_transaccion: e.target.value })}
                >
                  <option value="">— seleccione —</option>
                  {opcionesConcepto.map((o: any) => (
                    <option key={o[conceptoKey]} value={o[conceptoKey]}>
                      {o[conceptoKey]} — {o.descripcion}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Monto (RD$) <span className="text-destructive">*</span></Label>
              <Input type="number" step="0.01" value={form.monto}
                onChange={(e) => setForm({ ...form, monto: e.target.value })}
                placeholder="0.00" />
            </div>
            <p className="text-xs text-muted-foreground">
              Al guardar, la nómina <b>{f.nomina}</b> se reabrirá automáticamente
              para que el próximo cálculo incluya este movimiento.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(false)} disabled={create.isPending}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={!required || create.isPending}>
              {create.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
