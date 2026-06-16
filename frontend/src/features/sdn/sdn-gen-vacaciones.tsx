// SDN — Generar Vacaciones (Fsdn401).
// Calcula los días de vacaciones según TSDN_ESCALA_MESES (tipo_escala='V') para
// todos los empleados activos con FECHA_INGRESO < año dado, y los inserta en
// TSDN_VACACIONES. Soporta modo "previo" (dry_run) para revisar antes de grabar.
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { CalendarDays, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

const fmtN = (n: number) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

export function SdnGenVacaciones() {
  const { selectedCompany, selectedPoint } = useCompany()
  const hoy = new Date()
  const [f, setF] = useState({
    nomina: '',
    ano: hoy.getFullYear(),
  })

  const nominas = useQuery({
    queryKey: ['sdn-nominas-vac', selectedCompany, selectedPoint],
    queryFn: () => api.sdnListNominas({
      no_cia: selectedCompany, punto: selectedPoint, estado: 'A', limit: 100,
    }),
    enabled: !!selectedCompany,
  })

  const preview = useMutation({
    mutationFn: () => api.sdnGenerarVacaciones({
      no_cia: selectedCompany, punto: selectedPoint,
      nomina: f.nomina, ano: Number(f.ano), dry_run: true,
    }),
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo calcular el previo'),
  })

  const grabar = useMutation({
    mutationFn: () => api.sdnGenerarVacaciones({
      no_cia: selectedCompany, punto: selectedPoint,
      nomina: f.nomina, ano: Number(f.ano), dry_run: false,
    }),
    onSuccess: (out: any) => {
      toast.success(`Vacaciones generadas: ${out.creados} empleados, ${out.total_dias} días.`)
      preview.reset()
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudieron generar'),
  })

  const data: any = preview.data
  const empleados: any[] = data?.empleados || []

  if (!selectedCompany) {
    return <p className="text-muted-foreground py-8 text-center">Seleccione una empresa para generar vacaciones.</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Generar Vacaciones</h3>
        <p className="text-sm text-muted-foreground">
          Calcula los días de vacaciones por escala y los persiste en
          <code className="mx-1">SDN.TSDN_VACACIONES</code>. Equivale a <i>Fsdn401</i>.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded border bg-muted/30 p-3">
        <div>
          <Label className="text-xs">Nómina</Label>
          <select
            className="border rounded px-3 py-2 text-sm h-9 min-w-[220px] bg-background"
            value={f.nomina}
            onChange={(e) => { setF({ ...f, nomina: e.target.value }); preview.reset() }}
          >
            <option value="">— seleccione —</option>
            {(nominas.data || []).map((n: any) => (
              <option key={`${n.nomina}-${n.ano_proceso}-${n.mes_proceso}`} value={n.nomina}>
                {n.nomina} — {n.descripcion}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Año</Label>
          <Input className="w-28 h-9" type="number" value={f.ano}
            onChange={(e) => { setF({ ...f, ano: Number(e.target.value) }); preview.reset() }} />
        </div>
        <Button size="sm" variant="outline" onClick={() => preview.mutate()}
          disabled={!f.nomina || !f.ano || preview.isPending}>
          <CalendarDays className="h-4 w-4 mr-1" />
          {preview.isPending ? 'Calculando…' : 'Calcular previo'}
        </Button>
        <Button size="sm" disabled={!data || grabar.isPending || empleados.length === 0}
          onClick={() => {
            if (confirm(`¿Generar vacaciones para ${data.total_empleados} empleados (${data.total_dias} días)?\n` +
              `Esto eliminará y reemplazará las vacaciones existentes del año ${f.ano} en la nómina ${f.nomina}.`)) {
              grabar.mutate()
            }
          }}>
          {grabar.isPending ? 'Grabando…' : 'Grabar vacaciones'}
        </Button>
      </div>

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Empleados con derecho</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{fmtN(data.total_empleados)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total días</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{fmtN(data.total_dias)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Año</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{data.ano}</CardContent>
          </Card>
        </div>
      )}

      {preview.isPending ? <Skeleton className="h-40 w-full" /> : data ? (
        <div className="rounded border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Empleado</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="w-28">Fecha ingreso</TableHead>
                <TableHead className="w-28 text-right">Meses trabajados</TableHead>
                <TableHead className="w-24 text-right">Días vacaciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empleados.map((e) => (
                <TableRow key={e.no_empleado}>
                  <TableCell className="font-mono">{e.no_empleado}</TableCell>
                  <TableCell>{e.nombre_empleado}</TableCell>
                  <TableCell className="text-xs">{e.fecha_ingreso || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{e.meses_trabajados}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Badge variant="default">{e.dias}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {empleados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    <div className="flex items-center justify-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      No hay empleados con derecho a vacaciones bajo esta escala/año.
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Seleccione nómina y año y haga clic en <b>Calcular previo</b> para ver qué se grabará.
        </p>
      )}
    </div>
  )
}
