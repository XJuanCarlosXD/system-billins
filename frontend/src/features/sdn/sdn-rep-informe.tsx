// SDN — Informe de Nómina (Fsdn207).
// Reporte agregado por empleado del período seleccionado, con filtros por
// nómina / año / mes / período / gerencia / área / departamento / empleado.
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
import { Search, FileDown, Printer } from 'lucide-react'
import { toast } from 'sonner'

const fmt = (n: number) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Por defecto sugerimos el período inmediatamente anterior al actual: si hoy
// estamos en la 2da quincena, mostramos la 1ra; si estamos en la 1ra del mes,
// retrocedemos al mes anterior con su 2da quincena. Esto es lo que típicamente
// el usuario quiere ver (la nómina ya cerrada).
function periodoAnterior(d: Date) {
  const ano0 = d.getFullYear()
  const mes0 = d.getMonth() + 1
  const dia0 = d.getDate()
  if (dia0 > 15) return { ano: ano0, mes: mes0, periodo: 1 }
  if (mes0 === 1) return { ano: ano0 - 1, mes: 12, periodo: 2 }
  return { ano: ano0, mes: mes0 - 1, periodo: 2 }
}

export function SdnRepInforme() {
  const { selectedCompany, selectedPoint } = useCompany()
  const def = periodoAnterior(new Date())
  const [f, setF] = useState({
    nomina: '',
    ano: def.ano,
    mes: def.mes,
    periodo: def.periodo,
    no_gerencia: '',
    no_area: '',
    no_depto: '',
    no_empleado: '',
  })

  const nominas = useQuery({
    queryKey: ['sdn-nominas-inf', selectedCompany, selectedPoint],
    queryFn: () => api.sdnListNominas({
      no_cia: selectedCompany, punto: selectedPoint, limit: 100,
    }),
    enabled: !!selectedCompany,
  })
  const gerencias = useQuery({ queryKey: ['sdn-gerencias'], queryFn: () => api.sdnListGerencias() })
  const areas = useQuery({ queryKey: ['sdn-areas'], queryFn: () => api.sdnListAreas() })
  const deptos = useQuery({ queryKey: ['sdn-deptos'], queryFn: () => api.sdnListDeptos() })

  const run = useMutation({
    mutationFn: () => api.sdnRepInforme({
      no_cia: selectedCompany, punto: selectedPoint,
      nomina: f.nomina, ano: f.ano, mes: f.mes, periodo: f.periodo,
      no_empleado: f.no_empleado ? Number(f.no_empleado) : undefined,
      no_gerencia: f.no_gerencia || undefined,
      no_area: f.no_area || undefined,
      no_depto: f.no_depto || undefined,
    }),
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo generar el informe'),
  })

  const data: any = run.data
  const filas: any[] = data?.empleados || []

  const exportCsv = () => {
    if (!data) return
    const headers = ['Empleado', 'Nombre', 'Cedula', 'Gerencia', 'Area', 'Depto',
      'Salario', 'Ingresos', 'Deducciones', 'Bruto', 'Neto']
    const esc = (v: any) => {
      const s = String(v ?? '')
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s
    }
    const rows = filas.map((r) => [r.no_empleado, r.nombre_empleado, r.cedula,
      r.no_gerencia, r.no_area, r.no_depto,
      r.salario_mensual, r.total_ingresos, r.total_deducciones, r.bruto, r.neto])
    const csv = [headers, ...rows].map((row) => row.map(esc).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `sdn-informe-${f.nomina}-${f.ano}${String(f.mes).padStart(2, '0')}.csv`
    a.click()
  }

  if (!selectedCompany) {
    return <p className="text-muted-foreground py-8 text-center">Seleccione una empresa.</p>
  }

  const areasFiltradas = f.no_gerencia
    ? (areas.data || []).filter((a: any) => a.no_gerencia === f.no_gerencia)
    : areas.data || []
  const deptosFiltrados = f.no_area && f.no_gerencia
    ? (deptos.data || []).filter((d: any) => d.no_gerencia === f.no_gerencia && d.no_area === f.no_area)
    : deptos.data || []

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Informe de Nómina</h3>
        <p className="text-sm text-muted-foreground">
          Detalle agregado por empleado del período seleccionado. Equivale a
          <i className="mx-1">Fsdn207</i> · tablas <code>TSDN_MOVIMIENTO</code> + <code>TSDN_EMPLEADO</code>.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 items-end gap-3 rounded border bg-muted/30 p-3">
        <div className="col-span-2">
          <Label className="text-xs">Nómina</Label>
          <select
            className="border rounded px-2 py-2 text-sm h-9 w-full bg-background"
            value={f.nomina}
            onChange={(e) => setF({ ...f, nomina: e.target.value })}
          >
            <option value="">— seleccione —</option>
            {(nominas.data || []).map((n: any) => (
              <option key={`${n.nomina}-${n.ano_proceso}-${n.mes_proceso}-${n.periodo}`} value={n.nomina}>
                {n.nomina} — {n.descripcion}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Año</Label>
          <Input className="h-9" type="number" value={f.ano}
            onChange={(e) => setF({ ...f, ano: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Mes</Label>
          <Input className="h-9" type="number" min={1} max={12} value={f.mes}
            onChange={(e) => setF({ ...f, mes: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Período</Label>
          <select
            className="border rounded px-2 py-2 text-sm h-9 w-full bg-background"
            value={f.periodo}
            onChange={(e) => setF({ ...f, periodo: Number(e.target.value) })}
          >
            <option value={1}>P1</option>
            <option value={2}>P2</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">Empleado #</Label>
          <Input className="h-9" type="number" value={f.no_empleado}
            onChange={(e) => setF({ ...f, no_empleado: e.target.value })}
            placeholder="opcional" />
        </div>
        <div>
          <Label className="text-xs">Gerencia</Label>
          <select
            className="border rounded px-2 py-2 text-sm h-9 w-full bg-background"
            value={f.no_gerencia}
            onChange={(e) => setF({ ...f, no_gerencia: e.target.value, no_area: '', no_depto: '' })}
          >
            <option value="">Todas</option>
            {(gerencias.data || []).map((g: any) => (
              <option key={g.no_gerencia} value={g.no_gerencia}>{g.no_gerencia} — {g.descripcion}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Área</Label>
          <select
            className="border rounded px-2 py-2 text-sm h-9 w-full bg-background"
            value={f.no_area}
            onChange={(e) => setF({ ...f, no_area: e.target.value, no_depto: '' })}
            disabled={!f.no_gerencia}
          >
            <option value="">Todas</option>
            {areasFiltradas.map((a: any) => (
              <option key={`${a.no_gerencia}-${a.no_area}`} value={a.no_area}>{a.no_area} — {a.descripcion}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Depto</Label>
          <select
            className="border rounded px-2 py-2 text-sm h-9 w-full bg-background"
            value={f.no_depto}
            onChange={(e) => setF({ ...f, no_depto: e.target.value })}
            disabled={!f.no_area}
          >
            <option value="">Todos</option>
            {deptosFiltrados.map((d: any) => (
              <option key={`${d.no_gerencia}-${d.no_area}-${d.no_depto}`} value={d.no_depto}>{d.no_depto} — {d.descripcion}</option>
            ))}
          </select>
        </div>
        <Button size="sm" onClick={() => run.mutate()} disabled={!f.nomina || run.isPending}>
          <Search className="h-4 w-4 mr-1" />
          {run.isPending ? 'Generando…' : 'Generar'}
        </Button>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!data || filas.length === 0}>
          <FileDown className="h-4 w-4 mr-1" /> CSV
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!f.nomina}
          onClick={() => {
            const qs = new URLSearchParams({
              no_cia: selectedCompany, punto: selectedPoint,
              nomina: f.nomina, ano: String(f.ano), mes: String(f.mes), periodo: String(f.periodo),
              ...(f.no_empleado ? { no_empleado: String(f.no_empleado) } : {}),
              ...(f.no_gerencia ? { no_gerencia: f.no_gerencia } : {}),
              ...(f.no_area ? { no_area: f.no_area } : {}),
              ...(f.no_depto ? { no_depto: f.no_depto } : {}),
            }).toString()
            window.open(`/print/sdn-informe-nomina/_?${qs}`, '_blank')
          }}
        >
          <Printer className="h-4 w-4 mr-1" /> PDF
        </Button>
      </div>

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Empleados</CardTitle></CardHeader>
            <CardContent className="text-xl font-semibold">{data.totales.empleados}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Salario base</CardTitle></CardHeader>
            <CardContent className="text-xl font-semibold">RD$ {fmt(data.totales.salario)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Ingresos</CardTitle></CardHeader>
            <CardContent className="text-xl font-semibold">RD$ {fmt(data.totales.ingresos)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Deducciones</CardTitle></CardHeader>
            <CardContent className="text-xl font-semibold">RD$ {fmt(data.totales.deducciones)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Neto</CardTitle></CardHeader>
            <CardContent className="text-xl font-semibold">RD$ {fmt(data.totales.neto)}</CardContent>
          </Card>
        </div>
      )}

      {run.isPending ? <Skeleton className="h-40 w-full" /> : data ? (
        <div className="rounded border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Empleado</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="w-32">Cédula</TableHead>
                <TableHead className="w-16">Ger.</TableHead>
                <TableHead className="w-16">Área</TableHead>
                <TableHead className="w-16">Depto.</TableHead>
                <TableHead className="text-right">Salario</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Deducciones</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right font-semibold">Neto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((r) => (
                <TableRow key={r.no_empleado}>
                  <TableCell className="font-mono">{r.no_empleado}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={r.nombre_empleado}>{r.nombre_empleado}</TableCell>
                  <TableCell className="font-mono text-xs">{r.cedula}</TableCell>
                  <TableCell className="text-xs">{r.no_gerencia}</TableCell>
                  <TableCell className="text-xs">{r.no_area}</TableCell>
                  <TableCell className="text-xs">{r.no_depto}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{fmt(r.salario_mensual)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{fmt(r.total_ingresos)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{fmt(r.total_deducciones)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{fmt(r.bruto)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums font-semibold">{fmt(r.neto)}</TableCell>
                </TableRow>
              ))}
              {filas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-6">
                    Sin empleados que cumplan los filtros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Seleccione la nómina y el período, luego pulse <b>Generar</b>.
        </p>
      )}
    </div>
  )
}
