// ACF — Depreciación Mensual (Facf301).
// Recorre activos depreciables y calcula la cuota del mes vía /api/acf/depreciacion/.
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Calculator, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const METODO_LABEL: Record<string, string> = {
  L: 'Línea recta', S: 'Saldos decrecientes', U: 'Unidades producidas',
}

export function AcfDepreciacion() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const [confirm, setConfirm] = useState(false)
  const [cuentaGasto, setCuentaGasto] = useState('')
  const [cuentaAcum, setCuentaAcum] = useState('')

  const previewQ = useQuery({
    queryKey: ['acf-depre-preview', selectedCompany, selectedPoint],
    queryFn: () => api.acfDepreciacionPreview(selectedCompany, selectedPoint),
    enabled: !!selectedCompany && !!selectedPoint,
  })

  const aplicar = useMutation({
    mutationFn: () => api.acfAplicarDepreciacion({
      no_cia: selectedCompany, punto: selectedPoint,
      cuenta_gasto: cuentaGasto.trim(),
      cuenta_acumulada: cuentaAcum.trim(),
    }),
    onSuccess: (res) => {
      toast.success(
        `Depreciación ${res.periodo}: ${res.procesados} activos · RD$ ${fmt(res.total_depreciado)}`)
      setConfirm(false)
      qc.invalidateQueries({ queryKey: ['acf-depre-preview'] })
      qc.invalidateQueries({ queryKey: ['acf-act'] })
      qc.invalidateQueries({ queryKey: ['acf-cierre-status'] })
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo aplicar la depreciación'),
  })

  const p: any = previewQ.data || {}
  const tieneActivos = Number(p.cantidad || 0) > 0

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Depreciación Mensual</h3>
        <p className="text-sm text-muted-foreground">
          Aplica la depreciación lineal del mes activo a todos los activos
          marcados como depreciables. Equivale a <i>Facf301 — Depreciación</i>.
          Genera un documento <code>tipo_movi='D'</code> por activo.
        </p>
      </div>

      {previewQ.isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card><CardContent className="py-3">
            <div className="text-xs text-muted-foreground">Período activo</div>
            <div className="text-xl font-semibold">{p.periodo || '—'}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Método: {METODO_LABEL[p.metodo] || p.metodo || '—'}
            </div>
          </CardContent></Card>
          <Card><CardContent className="py-3">
            <div className="text-xs text-muted-foreground">Activos pendientes</div>
            <div className={`text-2xl font-semibold ${tieneActivos ? '' : 'text-muted-foreground'}`}>
              {p.cantidad ?? 0}
            </div>
          </CardContent></Card>
          <Card><CardContent className="py-3">
            <div className="text-xs text-muted-foreground">Total estimado del mes</div>
            <div className="text-xl font-semibold tabular-nums">
              RD$ {fmt(p.total_estimado)}
            </div>
          </CardContent></Card>
          <Card><CardContent className="py-3 flex flex-col gap-2">
            <div className="text-xs text-muted-foreground">Acciones</div>
            <Button variant="outline" size="sm" onClick={() => previewQ.refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Recalcular
            </Button>
            <Button size="sm" disabled={!tieneActivos}
                    onClick={() => setConfirm(true)}>
              <Calculator className="h-4 w-4 mr-1" /> Aplicar depreciación
            </Button>
          </CardContent></Card>
        </div>
      )}

      {!tieneActivos && previewQ.isSuccess && !p.error && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 flex gap-2 items-start">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          No hay activos pendientes de depreciar este mes. Puedes proceder con
          el <b>cierre mensual</b>.
        </div>
      )}

      {p.error && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex gap-2 items-start">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          {p.error}
        </div>
      )}

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-emerald-600" />
              Aplicar depreciación {p.periodo}
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-3 py-2">
            <p>
              Se procesarán <b>{p.cantidad}</b> activos por un total estimado de{' '}
              <b className="tabular-nums">RD$ {fmt(p.total_estimado)}</b>. Cada activo
              actualizará <code>depre_acumu</code> y se generará un documento de tipo 'D'.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs">Cuenta gasto (debe)</Label>
                <Input value={cuentaGasto} onChange={(e) => setCuentaGasto(e.target.value)}
                       placeholder="Opcional — usa la del catálogo si vacío"
                       className="h-9 font-mono" maxLength={24} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cuenta depre. acumulada (haber)</Label>
                <Input value={cuentaAcum} onChange={(e) => setCuentaAcum(e.target.value)}
                       placeholder="Opcional"
                       className="h-9 font-mono" maxLength={24} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>Cancelar</Button>
            <Button onClick={() => aplicar.mutate()} disabled={aplicar.isPending}>
              <Calculator className="h-4 w-4 mr-1" />
              {aplicar.isPending ? 'Procesando…' : 'Sí, aplicar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
