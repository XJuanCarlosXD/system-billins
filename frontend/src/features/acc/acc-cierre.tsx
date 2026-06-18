// ACC — Cierre Mensual de Caja Chica (Facc403).
// Valida que no haya docs sin contabilizar y aplica el cierre en TACC_CIERRE.
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Lock, AlertTriangle, CheckCircle2 } from 'lucide-react'

const fmtDate = (s: any) => s ? String(s).slice(0, 10) : ''
const fmtDt = (s: any) => s ? String(s).slice(0, 16).replace('T', ' ') : ''

const MES_LABEL = ['',
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function AccCierre() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const [confirm, setConfirm] = useState(false)

  const statusQ = useQuery({
    queryKey: ['acc-cierre-status', selectedCompany, selectedPoint],
    queryFn: () => api.accCierreStatus({ no_cia: selectedCompany, punto: selectedPoint }),
    enabled: !!selectedCompany,
  })
  const cierresQ = useQuery({
    queryKey: ['acc-cierres', selectedCompany, selectedPoint],
    queryFn: () => api.accListCierres({ no_cia: selectedCompany, punto: selectedPoint }),
    enabled: !!selectedCompany,
  })

  const aplicar = useMutation({
    mutationFn: () => api.accAplicarCierre({ no_cia: selectedCompany, punto: selectedPoint }),
    onSuccess: (res) => {
      toast.success(`Cierre aplicado: período ${res.cerrado} → ${res.nuevo_periodo}`)
      setConfirm(false)
      qc.invalidateQueries({ queryKey: ['acc-cierre-status'] })
      qc.invalidateQueries({ queryKey: ['acc-cierres'] })
    },
    onError: (e: any) => { toast.error(e?.detail?.error || 'No se pudo aplicar el cierre') },
  })

  const status: any = statusQ.data
  const cierres: any[] = cierresQ.data || []
  const punto = status?.punto
  const periodoActual = punto
    ? `${MES_LABEL[Number(punto.mes_proceso)] || punto.mes_proceso} ${punto.ano_proceso}`
    : '—'

  const sinCnt = Number(status?.documentos_sin_contabilizar || 0)
  const sinRep = Number(status?.documentos_sin_reposicion || 0)
  const puedeCerrar = sinCnt === 0

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Cierre Mensual</h3>
        <p className="text-sm text-muted-foreground">
          Equivale a <i>Facc403 — Cierre Mensual</i>. Registra el cierre del
          período activo en <code>TACC_CIERRE</code> y avanza el mes en
          <code>TACC_PUNTO</code>. Sólo permite cerrar cuando no hay documentos
          sin contabilizar.
        </p>
      </div>

      {statusQ.isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card><CardContent className="py-3">
            <div className="text-xs text-muted-foreground">Período activo</div>
            <div className="text-xl font-semibold">{periodoActual}</div>
          </CardContent></Card>
          <Card><CardContent className="py-3">
            <div className="text-xs text-muted-foreground">Sin contabilizar</div>
            <div className={`text-2xl font-semibold ${sinCnt > 0 ? 'text-destructive' : ''}`}>{sinCnt}</div>
          </CardContent></Card>
          <Card><CardContent className="py-3">
            <div className="text-xs text-muted-foreground">Sin reposición</div>
            <div className="text-2xl font-semibold">{sinRep}</div>
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

      {!puedeCerrar && status && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex gap-2 items-start">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            Hay <b>{sinCnt}</b> documentos sin contabilizar en el período actual.
            Genera primero el asiento contable en <i>Cierre → Asiento Contable</i>{' '}
            y vuelve aquí para aplicar el cierre.
          </div>
        </div>
      )}

      {/* Histórico de cierres */}
      <div className="rounded border">
        <div className="border-b px-3 py-2 text-sm font-medium">Cierres anteriores</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Año</TableHead>
              <TableHead className="w-24">Mes</TableHead>
              <TableHead>Fecha cierre</TableHead>
              <TableHead>Usuario</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cierresQ.isLoading ? (
              <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Cargando…</TableCell></TableRow>
            ) : cierres.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                Sin cierres registrados para esta empresa/punto.
              </TableCell></TableRow>
            ) : (
              cierres.map((c) => (
                <TableRow key={`${c.ano}-${c.mes}`}>
                  <TableCell className="font-mono">{c.ano}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {String(c.mes).padStart(2, '0')} · {MES_LABEL[Number(c.mes)] || c.mes}
                    </Badge>
                  </TableCell>
                  <TableCell>{fmtDt(c.fecha_cierre)}</TableCell>
                  <TableCell className="text-xs">{c.usuario}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Confirmación */}
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Confirmar cierre {periodoActual}
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-2 py-2">
            <p>
              Vas a cerrar el período <b>{periodoActual}</b> para la empresa <b>{selectedCompany}</b>{' '}
              punto <b>{selectedPoint}</b>.
            </p>
            <ul className="list-disc list-inside text-muted-foreground text-xs">
              <li>Se inserta una fila en <code>TACC_CIERRE</code> con la fecha actual.</li>
              <li>Se avanza <code>TACC_PUNTO.mes_proceso</code> al siguiente mes.</li>
              <li>No se podrán cargar más documentos con fecha del mes cerrado.</li>
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
