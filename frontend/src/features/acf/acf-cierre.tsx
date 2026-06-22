// ACF — Cierre Mensual (Facf403).
// Inserta TACF_CIERRE + avanza TACF_PUNTO.mes_proceso. Requiere depreciación aplicada.
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Lock, AlertTriangle, CheckCircle2, Printer } from 'lucide-react'

const fmtDt = (s: any) => s ? String(s).slice(0, 16).replace('T', ' ') : ''
const MES_LABEL = ['',
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function AcfCierre() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const [confirm, setConfirm] = useState(false)

  const statusQ = useQuery({
    queryKey: ['acf-cierre-status', selectedCompany, selectedPoint],
    queryFn: () => api.acfCierreStatus(selectedCompany, selectedPoint),
    enabled: !!selectedCompany && !!selectedPoint,
  })
  const cierresQ = useQuery({
    queryKey: ['acf-cierres', selectedCompany, selectedPoint],
    queryFn: () => api.acfListCierres(selectedCompany, selectedPoint),
    enabled: !!selectedCompany && !!selectedPoint,
  })

  const aplicar = useMutation({
    mutationFn: () => api.acfAplicarCierre({
      no_cia: selectedCompany, punto: selectedPoint,
    }),
    onSuccess: (res) => {
      toast.success(`Cierre aplicado: período ${res.cerrado} → ${res.nuevo_periodo}`)
      setConfirm(false)
      qc.invalidateQueries({ queryKey: ['acf-cierre-status'] })
      qc.invalidateQueries({ queryKey: ['acf-cierres'] })
      qc.invalidateQueries({ queryKey: ['acf-depre-preview'] })
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo aplicar el cierre'),
  })

  const s: any = statusQ.data || {}
  const cierres: any[] = cierresQ.data || []
  const punto = s.punto
  const periodoActual = punto
    ? `${MES_LABEL[Number(punto.mes_proceso)] || punto.mes_proceso} ${punto.ano_proceso}`
    : '—'
  const sinDepre = Number(s.activos_sin_depreciar || 0)
  const puedeCerrar = sinDepre === 0

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Cierre Mensual</h3>
        <p className="text-sm text-muted-foreground">
          Cierra el período de Activos Fijos. Equivale a <i>Facf403 — Cierre Mensual</i>.
          Solo permite cerrar cuando todos los activos depreciables del mes
          fueron procesados.
        </p>
      </div>

      {statusQ.isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card><CardContent className="py-3">
            <div className="text-xs text-muted-foreground">Período activo</div>
            <div className="text-xl font-semibold">{periodoActual}</div>
          </CardContent></Card>
          <Card><CardContent className="py-3">
            <div className="text-xs text-muted-foreground">Sin depreciar</div>
            <div className={`text-2xl font-semibold ${sinDepre > 0 ? 'text-destructive' : ''}`}>
              {sinDepre}
            </div>
          </CardContent></Card>
          <Card><CardContent className="py-3">
            <div className="text-xs text-muted-foreground">Documentos sin contabilizar</div>
            <div className="text-2xl font-semibold">
              {s.documentos_sin_contabilizar ?? 0}
            </div>
          </CardContent></Card>
          <Card><CardContent className="py-3 flex flex-col gap-2">
            <div className="text-xs text-muted-foreground">Acción</div>
            <Button onClick={() => setConfirm(true)} disabled={!puedeCerrar}
                    variant={puedeCerrar ? 'default' : 'outline'}>
              <Lock className="h-4 w-4 mr-1" /> Aplicar cierre
            </Button>
          </CardContent></Card>
        </div>
      )}

      {!puedeCerrar && punto && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex gap-2 items-start">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            Hay <b>{sinDepre}</b> activos pendientes de depreciar en{' '}
            {periodoActual}. Aplica la depreciación del mes en{' '}
            <i>Procesos → Depreciación Mensual</i> y vuelve aquí para cerrar.
          </div>
        </div>
      )}

      <div className="rounded border">
        <div className="border-b px-3 py-2 text-sm font-medium">Cierres anteriores</div>
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-24">Año</TableHead>
            <TableHead className="w-32">Mes</TableHead>
            <TableHead>Fecha cierre</TableHead>
            <TableHead>Usuario</TableHead>
            <TableHead className="w-24 text-right">Imprimir</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {cierresQ.isLoading ? (
              <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Cargando…</TableCell></TableRow>
            ) : cierres.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                Sin cierres registrados para esta empresa/punto.
              </TableCell></TableRow>
            ) : cierres.map((c) => {
              const id = `${c.ano}-${String(c.mes).padStart(2, '0')}`
              return (
                <TableRow key={`${c.ano}-${c.mes}`}>
                  <TableCell className="font-mono">{c.ano}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {String(c.mes).padStart(2, '0')} · {MES_LABEL[Number(c.mes)] || c.mes}
                    </Badge>
                  </TableCell>
                  <TableCell>{fmtDt(c.fecha_cierre)}</TableCell>
                  <TableCell className="text-xs">{c.usuario}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost"
                            onClick={() => window.open(
                              `/print/comprobante-cierre-acf/${encodeURIComponent(id)}?no_cia=${selectedCompany}&punto=${selectedPoint}`,
                              '_blank')}>
                      <Printer className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Confirmar cierre {periodoActual}
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-2 py-2">
            <p>
              Vas a cerrar el período <b>{periodoActual}</b> para la empresa{' '}
              <b>{selectedCompany}</b> punto <b>{selectedPoint}</b>.
            </p>
            <ul className="list-disc list-inside text-muted-foreground text-xs">
              <li>Se inserta una fila en <code>TACF_CIERRE</code> con la fecha actual.</li>
              <li>Se avanza <code>TACF_PUNTO.mes_proceso</code> al siguiente mes.</li>
              <li>Los activos se marcan como pendientes para el nuevo mes.</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>Cancelar</Button>
            <Button onClick={() => aplicar.mutate()} disabled={aplicar.isPending}>
              <Lock className="h-4 w-4 mr-1" />
              {aplicar.isPending ? 'Aplicando…' : 'Sí, aplicar cierre'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
