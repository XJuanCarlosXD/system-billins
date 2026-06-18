import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { CheckCircle2, Search, X, Printer } from 'lucide-react'

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (s: any) => s ? String(s).slice(0, 10) : ''

interface Orden {
  no_cia: string; punto: string; no_orden: string
  no_proveedor: string; nombre_proveedor: string
  rnc: string; fecha: string; fecha_entrega: string
  total_neto: number; usuario: string; detalle: string
  autorizada_por: string | null
}

export function OdcAutorizar() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const [filtros, setFiltros] = useState({
    search: '', monto_min: '', monto_max: '',
    fecha_desde: '', fecha_hasta: '',
  })
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())

  // Pendientes de autorización = estado='P' AND st_anulado='A' AND autorizada_por IS NULL.
  // El filtrado fino es client-side: el dataset es pequeño (sólo pendientes).
  const { data: dataRaw = [], isLoading } = useQuery<Orden[]>({
    queryKey: ['odc-pend-autorizar', selectedCompany, selectedPoint, filtros.fecha_desde, filtros.fecha_hasta],
    queryFn: () => api.odcListOrdenes({
      no_cia: selectedCompany, punto: selectedPoint,
      estado: 'P', st_anulado: 'A',
      fecha_desde: filtros.fecha_desde || undefined,
      fecha_hasta: filtros.fecha_hasta || undefined,
      limit: 500,
    }),
  })

  const data = useMemo<Orden[]>(() => {
    const term = filtros.search.trim().toLowerCase()
    const min = Number(filtros.monto_min) || 0
    const max = Number(filtros.monto_max) || Infinity
    return dataRaw.filter((o: any) => {
      if (o.autorizada_por) return false
      const monto = Number(o.total_neto) || 0
      if (monto < min || monto > max) return false
      if (!term) return true
      const hay = `${o.no_orden} ${o.no_proveedor} ${o.nombre_proveedor || ''} ${o.rnc || ''} ${o.detalle || ''}`
        .toLowerCase()
      return hay.includes(term)
    })
  }, [dataRaw, filtros.search, filtros.monto_min, filtros.monto_max])

  const totalMonto = useMemo(() => data.reduce((acc, o) => acc + Number(o.total_neto || 0), 0), [data])
  const totalSel = useMemo(
    () => data.filter((o) => seleccion.has(o.no_orden)).reduce((acc, o) => acc + Number(o.total_neto || 0), 0),
    [data, seleccion],
  )

  const autorizar = useMutation({
    mutationFn: (o: Orden) => api.odcAutorizarOrden({ no_cia: o.no_cia, punto: o.punto, no_orden: o.no_orden }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['odc-pend-autorizar'] })
      qc.invalidateQueries({ queryKey: ['odc-ordenes'] })
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error al autorizar'),
  })

  const autorizarLote = useMutation({
    mutationFn: async () => {
      const sel = data.filter((o) => seleccion.has(o.no_orden))
      let ok = 0, fail = 0
      for (const o of sel) {
        try {
          await api.odcAutorizarOrden({ no_cia: o.no_cia, punto: o.punto, no_orden: o.no_orden })
          ok++
        } catch { fail++ }
      }
      return { ok, fail }
    },
    onSuccess: ({ ok, fail }) => {
      toast.success(`${ok} órden${ok !== 1 ? 'es' : ''} autorizada${ok !== 1 ? 's' : ''}${fail ? ` · ${fail} con error` : ''}`)
      setSeleccion(new Set())
      qc.invalidateQueries({ queryKey: ['odc-pend-autorizar'] })
      qc.invalidateQueries({ queryKey: ['odc-ordenes'] })
    },
  })

  const todasSel = data.length > 0 && data.every((o) => seleccion.has(o.no_orden))
  const algunasSel = !todasSel && data.some((o) => seleccion.has(o.no_orden))

  const toggleTodas = () => {
    if (todasSel) setSeleccion(new Set())
    else setSeleccion(new Set(data.map((o) => o.no_orden)))
  }

  const toggleUna = (no: string) => {
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(no)) next.delete(no); else next.add(no)
      return next
    })
  }

  const limpiar = () => setFiltros({ search: '', monto_min: '', monto_max: '', fecha_desde: '', fecha_hasta: '' })

  const verPdf = (o: Orden) => {
    const qs = new URLSearchParams({ no_cia: o.no_cia, punto: o.punto }).toString()
    window.open(`/print/orden-compra/${encodeURIComponent(o.no_orden)}?${qs}`, '_blank')
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Autorizar Órdenes pendientes</h3>
        <p className="text-sm text-muted-foreground">
          Sólo órdenes con estado <b>Pendiente</b>, no anuladas y sin autorización previa.
          Puedes autorizar una a una o varias en lote.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="py-3">
          <div className="text-xs text-muted-foreground">Pendientes (total)</div>
          <div className="text-2xl font-semibold">{dataRaw.filter((o: any) => !o.autorizada_por).length}</div>
        </CardContent></Card>
        <Card><CardContent className="py-3">
          <div className="text-xs text-muted-foreground">Filtradas</div>
          <div className="text-2xl font-semibold">{data.length}</div>
        </CardContent></Card>
        <Card><CardContent className="py-3">
          <div className="text-xs text-muted-foreground">Monto filtrado</div>
          <div className="text-xl font-semibold tabular-nums">RD$ {fmt(totalMonto)}</div>
        </CardContent></Card>
        <Card><CardContent className="py-3">
          <div className="text-xs text-muted-foreground">Seleccionadas · monto</div>
          <div className="text-xl font-semibold tabular-nums">
            {seleccion.size} · RD$ {fmt(totalSel)}
          </div>
        </CardContent></Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-2 rounded border bg-muted/30 px-3 py-2">
        <div className="grow max-w-md">
          <Label className="text-xs">Buscar (orden / proveedor / RNC / detalle)</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 h-9" value={filtros.search}
              onChange={(e) => setFiltros({ ...filtros, search: e.target.value })}
              placeholder="Ej. INDISA, 000443, ODC-4176…" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Desde</Label>
          <Input type="date" className="h-9 w-40" value={filtros.fecha_desde}
            onChange={(e) => setFiltros({ ...filtros, fecha_desde: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Hasta</Label>
          <Input type="date" className="h-9 w-40" value={filtros.fecha_hasta}
            onChange={(e) => setFiltros({ ...filtros, fecha_hasta: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Monto desde</Label>
          <Input type="number" min={0} step="0.01" className="h-9 w-32 tabular-nums" value={filtros.monto_min}
            onChange={(e) => setFiltros({ ...filtros, monto_min: e.target.value })} placeholder="0" />
        </div>
        <div>
          <Label className="text-xs">Monto hasta</Label>
          <Input type="number" min={0} step="0.01" className="h-9 w-32 tabular-nums" value={filtros.monto_max}
            onChange={(e) => setFiltros({ ...filtros, monto_max: e.target.value })} placeholder="∞" />
        </div>
        <Button size="sm" variant="ghost" onClick={limpiar} className="h-9">
          <X className="h-4 w-4 mr-1" /> Limpiar
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {seleccion.size > 0 && (
            <Button size="sm" onClick={() => autorizarLote.mutate()} disabled={autorizarLote.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {autorizarLote.isPending ? 'Autorizando…' : `Autorizar ${seleccion.size} seleccionada${seleccion.size !== 1 ? 's' : ''}`}
            </Button>
          )}
        </div>
      </div>

      {/* Tabla */}
      {isLoading ? <Skeleton className="h-60 w-full" /> : (
        <div className="rounded border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={todasSel ? true : algunasSel ? 'indeterminate' : false}
                    onCheckedChange={toggleTodas}
                    aria-label="Seleccionar todas"
                  />
                </TableHead>
                <TableHead>No. Orden</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((o) => (
                <TableRow key={`${o.no_cia}-${o.punto}-${o.no_orden}`}
                  className={seleccion.has(o.no_orden) ? 'bg-emerald-50/60' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={seleccion.has(o.no_orden)}
                      onCheckedChange={() => toggleUna(o.no_orden)}
                      aria-label={`Seleccionar ${o.no_orden}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">ODC-{o.no_orden}</TableCell>
                  <TableCell>{fmtDate(o.fecha)}</TableCell>
                  <TableCell>{fmtDate(o.fecha_entrega)}</TableCell>
                  <TableCell className="truncate max-w-xs">
                    <span className="font-mono text-xs text-muted-foreground">{o.no_proveedor}</span>
                    {' '}{o.nombre_proveedor}
                    {o.rnc && <Badge variant="outline" className="ml-2 font-mono text-[10px]">{o.rnc}</Badge>}
                  </TableCell>
                  <TableCell className="text-xs">{o.usuario}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">RD$ {fmt(o.total_neto)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => verPdf(o)} title="Ver PDF">
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={() => autorizar.mutate(o, {
                        onSuccess: () => toast.success(`ODC-${o.no_orden} autorizada`),
                      })} disabled={autorizar.isPending}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Autorizar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && data.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  {dataRaw.length === 0
                    ? 'No hay órdenes pendientes de autorización.'
                    : 'Ninguna orden coincide con los filtros actuales.'}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
