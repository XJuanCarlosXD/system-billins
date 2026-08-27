import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Calculator, CheckCircle2, RotateCcw, ArrowRightCircle,
} from 'lucide-react'

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (s: any) => (s ? String(s).slice(0, 10) : '')

type Nomina = {
  no_cia: string
  punto: string
  nomina: string
  descripcion: string
  forma_pago: string
  fecha_inicial?: string
  fecha_final?: string
  cuenta_contable: string
  mes_proceso: number
  ano_proceso: number
  periodo?: number
  calculo_nomina: string
  estado: string
  tipo_moneda?: string
}

const MONEDA_LABELS: Record<string, string> = { P: 'RD$', D: 'US$' }

export function SdnCalcular() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const [nominaSel, setNominaSel] = useState('')
  const [confirmar, setConfirmar] = useState<'C' | 'R' | null>(null)
  const [avanzando, setAvanzando] = useState(false)
  const [nuevoInicio, setNuevoInicio] = useState('')
  const [nuevoFin, setNuevoFin] = useState('')

  const nominasQ = useQuery({
    queryKey: ['sdn-nominas', selectedCompany, selectedPoint],
    queryFn: () => api.sdnListNominas({
      no_cia: selectedCompany, punto: selectedPoint, estado: 'A', limit: 200,
    }),
  })

  const lista: Nomina[] = (nominasQ.data || []).filter((n: Nomina) => n.estado === 'A')
  const nomina = lista.find((n) => n.nomina === nominaSel)

  const volanteQ = useQuery({
    queryKey: ['sdn-volante-pre', selectedCompany, selectedPoint, nominaSel],
    queryFn: () => api.sdnGetVolante({
      no_cia: selectedCompany, punto: selectedPoint, nomina: nominaSel,
    }),
    enabled: !!nominaSel,
  })

  const empleados = (volanteQ.data?.empleados || []) as any[]
  const totales = volanteQ.data?.totales || { empleados: 0, salario: 0, neto: 0, ingresos: 0, deducciones: 0 }

  const calcular = useMutation({
    mutationFn: () => api.sdnCalcularNomina({
      no_cia: selectedCompany, punto: selectedPoint, nomina: nominaSel,
    }),
    onSuccess: (res: any) => {
      toast.success(`Nómina ${res.nomina} marcada como calculada`)
      qc.invalidateQueries({ queryKey: ['sdn-nominas'] })
      qc.invalidateQueries({ queryKey: ['sdn-volante'] })
      qc.invalidateQueries({ queryKey: ['sdn-volante-pre'] })
      qc.invalidateQueries({ queryKey: ['sdn-rep-nominas'] })
      setConfirmar(null)
    },
    onError: (e: any) =>
      toast.error(e?.detail?.error || e?.message || 'No se pudo calcular la nómina'),
  })

  const reabrir = useMutation({
    mutationFn: () => api.sdnReabrirNomina({
      no_cia: selectedCompany, punto: selectedPoint, nomina: nominaSel,
    }),
    onSuccess: (res: any) => {
      toast.success(`Nómina ${res.nomina} reabierta para recálculo`)
      qc.invalidateQueries({ queryKey: ['sdn-nominas'] })
      qc.invalidateQueries({ queryKey: ['sdn-volante-pre'] })
      setConfirmar(null)
    },
    onError: (e: any) =>
      toast.error(e?.detail?.error || 'No se pudo reabrir la nómina'),
  })

  const abrirAvanzar = () => {
    if (!nomina?.fecha_final) return
    // Sugerencia: la siguiente quincena empieza al dia siguiente del cierre
    // actual y dura 15 dias. El usuario puede ajustar las fechas antes de
    // confirmar -- el backend no las infiere solo.
    const fin = new Date(`${nomina.fecha_final}T00:00:00`)
    const inicio = new Date(fin)
    inicio.setDate(inicio.getDate() + 1)
    const finSugerido = new Date(inicio)
    finSugerido.setDate(finSugerido.getDate() + 14)
    const toISO = (d: Date) => d.toISOString().slice(0, 10)
    setNuevoInicio(toISO(inicio))
    setNuevoFin(toISO(finSugerido))
    setAvanzando(true)
  }

  const avanzar = useMutation({
    mutationFn: () => {
      const inicio = new Date(`${nuevoInicio}T00:00:00`)
      return api.sdnAvanzarNomina({
        no_cia: selectedCompany, punto: selectedPoint, nomina: nominaSel,
        fecha_inicial: nuevoInicio, fecha_final: nuevoFin,
        ano_proceso: inicio.getFullYear(), mes_proceso: inicio.getMonth() + 1,
        periodo: (nomina?.periodo || 0) + 1,
      })
    },
    onSuccess: (res: any) => {
      toast.success(`Nómina ${res.nomina} avanzada al período ${fmtDate(res.fecha_inicial)} → ${fmtDate(res.fecha_final)}`)
      qc.invalidateQueries({ queryKey: ['sdn-nominas'] })
      qc.invalidateQueries({ queryKey: ['sdn-volante-pre'] })
      qc.invalidateQueries({ queryKey: ['sdn-rep-nominas'] })
      setAvanzando(false)
    },
    onError: (e: any) =>
      toast.error(e?.detail?.error || 'No se pudo avanzar la nómina al siguiente período'),
  })

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Calcular Nómina</h3>
        <p className="text-sm text-muted-foreground">
          Cierra el cálculo del período. Una vez calculada, la definición queda bloqueada
          y se habilitan la generación de archivo bancario y la solicitud de cheques.
          Equivale a <i>Fsdn203 — Cálculo de Nómina</i>. Marca{' '}
          <code>TSDN_NOMINA.CALCULO_NOMINA='S'</code> y registra auditoría en{' '}
          <code>TSDN_AUDITORIA</code>.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Selección de nómina
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nómina activa</Label>
              <Select value={nominaSel} onValueChange={setNominaSel}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecciona una nómina…" /></SelectTrigger>
                <SelectContent>
                  {lista.map((n) => (
                    <SelectItem key={n.nomina} value={n.nomina}>
                      {n.nomina} — {n.descripcion} · {String(n.mes_proceso).padStart(2, '0')}/{n.ano_proceso}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {nomina && (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm flex flex-wrap gap-x-6 gap-y-1">
                <span>
                  <span className="text-muted-foreground">Período: </span>
                  <span className="tabular-nums">
                    {String(nomina.mes_proceso).padStart(2, '0')}/{nomina.ano_proceso}
                    {nomina.periodo ? ` · #${nomina.periodo}` : ''}
                  </span>
                </span>
                <span>
                  <span className="text-muted-foreground">Fechas: </span>
                  {fmtDate(nomina.fecha_inicial)} → {fmtDate(nomina.fecha_final)}
                </span>
                <span>
                  <span className="text-muted-foreground">Estado: </span>
                  {nomina.calculo_nomina === 'S'
                    ? <Badge variant="outline">Calculada</Badge>
                    : <Badge variant="secondary">Pendiente</Badge>}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {nomina && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Resumen del cálculo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded border p-3">
                <div className="text-xs text-muted-foreground">Empleados</div>
                <div className="text-2xl font-semibold tabular-nums">{totales.empleados}</div>
              </div>
              <div className="rounded border p-3">
                <div className="text-xs text-muted-foreground">Salario base</div>
                <div className="text-2xl font-semibold tabular-nums">
                  {MONEDA_LABELS[nomina.tipo_moneda || 'P']} {fmt(totales.salario)}
                </div>
              </div>
              <div className="rounded border p-3">
                <div className="text-xs text-muted-foreground">Ingresos</div>
                <div className="text-2xl font-semibold tabular-nums">
                  {MONEDA_LABELS[nomina.tipo_moneda || 'P']} {fmt(totales.ingresos)}
                </div>
              </div>
              <div className="rounded border p-3">
                <div className="text-xs text-muted-foreground">Deducciones</div>
                <div className="text-2xl font-semibold tabular-nums">
                  {MONEDA_LABELS[nomina.tipo_moneda || 'P']} {fmt(totales.deducciones)}
                </div>
              </div>
            </div>

            <div className="rounded border bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <span><span className="text-xs uppercase text-emerald-700">Neto a pagar</span></span>
                <span className="text-2xl font-semibold tabular-nums">
                  {MONEDA_LABELS[nomina.tipo_moneda || 'P']} {fmt(totales.neto)}
                </span>
                <span className="text-xs text-emerald-700">
                  Cuenta contable {nomina.cuenta_contable}
                </span>
              </div>
            </div>

            {empleados.length === 0 && (
              <div className="rounded border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                No hay empleados activos asignados a esta nómina. Revise el maestro de
                empleados antes de calcular.
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t pt-3">
              {nomina.calculo_nomina === 'S' ? (
                <>
                  <Button variant="outline" onClick={() => setConfirmar('R')}
                          disabled={reabrir.isPending}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Reabrir para recálculo
                  </Button>
                  <Button onClick={abrirAvanzar} disabled={avanzar.isPending}>
                    <ArrowRightCircle className="h-4 w-4 mr-1" /> Avanzar a siguiente período
                  </Button>
                </>
              ) : (
                <Button onClick={() => setConfirmar('C')}
                        disabled={empleados.length === 0 || calcular.isPending}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Calcular nómina
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!confirmar} onOpenChange={(v) => { if (!v) setConfirmar(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmar === 'C'
                ? <><CheckCircle2 className="h-4 w-4" /> Confirmar cálculo</>
                : <><RotateCcw className="h-4 w-4" /> Confirmar reapertura</>}
            </DialogTitle>
          </DialogHeader>
          {nomina && (
            <div className="space-y-3 text-sm">
              {confirmar === 'C' ? (
                <div className="rounded border bg-muted/40 p-3">
                  Se marcará la nómina <b>{nomina.nomina} — {nomina.descripcion}</b> como
                  calculada para el período{' '}
                  <span className="font-mono">
                    {String(nomina.mes_proceso).padStart(2, '0')}/{nomina.ano_proceso}
                  </span>.
                  La definición no se podrá editar después.
                </div>
              ) : (
                <div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">
                  Se reabrirá la nómina para recálculo. Solo es posible si aún no se han
                  generado archivo bancario ni solicitud de cheques para este período.
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Empleados: </span>
                  <span className="tabular-nums">{totales.empleados}</span></div>
                <div><span className="text-muted-foreground">Neto: </span>
                  <span className="tabular-nums">
                    {MONEDA_LABELS[nomina.tipo_moneda || 'P']} {fmt(totales.neto)}
                  </span></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmar(null)}
                    disabled={calcular.isPending || reabrir.isPending}>
              Cancelar
            </Button>
            {confirmar === 'C' ? (
              <Button onClick={() => calcular.mutate()} disabled={calcular.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {calcular.isPending ? 'Calculando…' : 'Calcular'}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => reabrir.mutate()} disabled={reabrir.isPending}>
                <RotateCcw className="h-4 w-4 mr-1" />
                {reabrir.isPending ? 'Reabriendo…' : 'Reabrir'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={avanzando} onOpenChange={(v) => { if (!v) setAvanzando(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightCircle className="h-4 w-4" /> Avanzar al siguiente período
            </DialogTitle>
          </DialogHeader>
          {nomina && (
            <div className="space-y-3 text-sm">
              <div className="rounded border bg-muted/40 p-3">
                Se moverá la definición de <b>{nomina.nomina} — {nomina.descripcion}</b> del
                período actual ({fmtDate(nomina.fecha_inicial)} → {fmtDate(nomina.fecha_final)},
                calculado) al nuevo período de abajo, quedando lista para calcularse de nuevo.
                Solo aplica porque el período actual ya está calculado.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nueva fecha inicial</Label>
                  <Input type="date" value={nuevoInicio}
                         onChange={(e) => setNuevoInicio(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nueva fecha final</Label>
                  <Input type="date" value={nuevoFin}
                         onChange={(e) => setNuevoFin(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Período sugerido #{(nomina.periodo || 0) + 1}. Verifica las fechas antes de
                confirmar — no se calculan solas.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvanzando(false)}
                    disabled={avanzar.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => avanzar.mutate()}
                    disabled={avanzar.isPending || !nuevoInicio || !nuevoFin}>
              <ArrowRightCircle className="h-4 w-4 mr-1" />
              {avanzar.isPending ? 'Avanzando…' : 'Avanzar período'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
