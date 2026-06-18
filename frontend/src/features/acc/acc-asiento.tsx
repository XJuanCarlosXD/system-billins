// ACC — Asiento Contable de Caja Chica (Facc402).
// Preview agrupado por cuenta + botón "Generar a contabilidad".
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Search, CheckCircle2 } from 'lucide-react'

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function AccAsiento() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const hoy = new Date()
  const [ano, setAno] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)

  const previewQ = useQuery({
    queryKey: ['acc-asiento-preview', selectedCompany, selectedPoint, ano, mes],
    queryFn: () => api.accPreviewAsiento({
      no_cia: selectedCompany, punto: selectedPoint,
      ano: Number(ano), mes: Number(mes),
    }),
    enabled: !!selectedCompany && Number(ano) > 0 && Number(mes) > 0,
  })

  const generar = useMutation({
    mutationFn: () => api.accGenerarAsiento({
      no_cia: selectedCompany, punto: selectedPoint,
      ano: Number(ano), mes: Number(mes),
    }),
    onSuccess: (res) => {
      toast.success(`Asiento generado · ${res.documentos_actualizados} documentos marcados`)
      qc.invalidateQueries({ queryKey: ['acc-asiento-preview'] })
      qc.invalidateQueries({ queryKey: ['acc-cierre-status'] })
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error al generar el asiento'),
  })

  const data = previewQ.data
  const lineas: any[] = data?.lineas || []

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Imprimir / Generar Asiento Contable</h3>
        <p className="text-sm text-muted-foreground">
          Equivale a <i>Facc402 — Asiento Contable</i>. Agrupa <code>TACC_DCDOCU</code>
          por cuenta y tipo de movimiento para el período seleccionado y permite
          marcar los documentos como contabilizados (<code>ST_GENERADO_CNT='S'</code>).
        </p>
      </div>

      {/* Filtros */}
      <div className="flex items-end gap-2 rounded border bg-muted/30 px-3 py-2">
        <div>
          <Label className="text-xs">Año</Label>
          <Input type="number" className="w-28 h-9 tabular-nums" value={ano}
            onChange={(e) => setAno(Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs">Mes</Label>
          <Input type="number" min={1} max={12} className="w-20 h-9 tabular-nums" value={mes}
            onChange={(e) => setMes(Number(e.target.value))} />
        </div>
        <Button size="sm" variant="outline" onClick={() => previewQ.refetch()}>
          <Search className="h-4 w-4 mr-1" /> Calcular
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {data && data.cuadra && data.documentos > 0 && (
            <Badge variant="default">Cuadrado</Badge>
          )}
          {data && !data.cuadra && (
            <Badge variant="destructive">No cuadra</Badge>
          )}
          {data && (
            <Button size="sm" onClick={() => generar.mutate()}
              disabled={!data.cuadra || data.documentos === 0 || generar.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {generar.isPending ? 'Generando…' : 'Generar a contabilidad'}
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="py-3">
            <div className="text-xs text-muted-foreground">Documentos del período</div>
            <div className="text-2xl font-semibold">{data.documentos}</div>
          </CardContent></Card>
          <Card><CardContent className="py-3">
            <div className="text-xs text-muted-foreground">Total débito</div>
            <div className="text-xl font-semibold tabular-nums">RD$ {fmt(data.total_debito)}</div>
          </CardContent></Card>
          <Card><CardContent className="py-3">
            <div className="text-xs text-muted-foreground">Total crédito</div>
            <div className="text-xl font-semibold tabular-nums">RD$ {fmt(data.total_credito)}</div>
          </CardContent></Card>
          <Card><CardContent className="py-3">
            <div className="text-xs text-muted-foreground">Diferencia</div>
            <div className={`text-xl font-semibold tabular-nums ${data.cuadra ? '' : 'text-destructive'}`}>
              RD$ {fmt(Math.abs(data.total_debito - data.total_credito))}
            </div>
          </CardContent></Card>
        </div>
      )}

      {/* Detalle por cuenta */}
      {previewQ.isLoading ? <Skeleton className="h-60 w-full" /> : (
        <div className="rounded border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Cuenta</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-32">Centro costo</TableHead>
                <TableHead className="w-24 text-center">Movimiento</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineas.map((l, i) => (
                <TableRow key={`${l.cuenta}-${l.centro_costo}-${l.tipo_movi}-${i}`}>
                  <TableCell className="font-mono text-xs">{l.cuenta}</TableCell>
                  <TableCell>{l.desc_cuenta || '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{l.centro_costo}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={l.tipo_movi === 'D' ? 'default' : 'outline'}>
                      {l.tipo_movi === 'D' ? 'Débito' : 'Crédito'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">RD$ {fmt(l.monto)}</TableCell>
                </TableRow>
              ))}
              {lineas.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  No hay documentos pendientes de contabilizar en {String(mes).padStart(2, '0')}/{ano}.
                </TableCell></TableRow>
              )}
            </TableBody>
            {data && lineas.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-medium">Totales</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    DB RD$ {fmt(data.total_debito)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    CR RD$ {fmt(data.total_credito)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      )}
    </div>
  )
}
