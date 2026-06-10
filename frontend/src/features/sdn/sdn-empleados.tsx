import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Eye, Search, Loader2 } from 'lucide-react'

const fmtDate = (s: any) => s ? String(s).slice(0, 10) : ''

export function SdnEmpleados() {
  const { selectedCompany } = useCompany()
  const [search, setSearch] = useState('')
  const [activos, setActivos] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)

  const resQ = useQuery({ queryKey: ['sdn-rep-emp', selectedCompany], queryFn: () => api.sdnRepResumenEmpleados(selectedCompany) })
  const empQ = useQuery({
    queryKey: ['sdn-empleados', selectedCompany, search, activos],
    queryFn: () => api.sdnListEmpleados({ no_cia: selectedCompany, search, activos: activos ? '1' : '0', limit: 500 }),
  })

  const r: any = resQ.data || {}
  const rows = empQ.data || []

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{r.total ?? '—'}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Activos</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-emerald-600">{r.activos ?? '—'}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Egresados</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-muted-foreground">{r.egresados ?? '—'}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Fijos</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{r.fijos ?? '—'}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">No fijos</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{r.no_fijos ?? '—'}</CardContent></Card>
      </div>

      <div className="flex items-end gap-3">
        <div><Label className="text-xs">Buscar</Label><Input className="w-72 h-9" placeholder="Nombre / cédula / código…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm pb-1"><Checkbox checked={activos} onCheckedChange={(v) => setActivos(!!v)} /> Solo activos</label>
        <Button size="sm" variant="outline" onClick={() => empQ.refetch()}><Search className="h-4 w-4 mr-1" /> Buscar</Button>
        <div className="ml-auto text-sm text-muted-foreground">{rows.length} empleados</div>
      </div>

      {empQ.isLoading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>}

      <div className="rounded border overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>No.</TableHead><TableHead>Nombre</TableHead><TableHead>Cédula</TableHead>
            <TableHead>Nómina</TableHead><TableHead>Ingreso</TableHead><TableHead>Estado</TableHead>
            <TableHead>Email</TableHead><TableHead className="text-right">Ver</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((e: any) => (
              <TableRow key={e.no_empleado}>
                <TableCell className="font-mono text-xs">{e.no_empleado}</TableCell>
                <TableCell>{e.nombre} {e.apellido}</TableCell>
                <TableCell className="font-mono text-xs">{e.cedula}</TableCell>
                <TableCell>{e.nomina}</TableCell>
                <TableCell>{fmtDate(e.fecha_ingreso)}</TableCell>
                <TableCell>{e.fecha_egreso ? <Badge variant="secondary">Egresado {fmtDate(e.fecha_egreso)}</Badge> : <Badge>Activo</Badge>}</TableCell>
                <TableCell className="text-xs">{e.email1}</TableCell>
                <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setSelected(e)}><Eye className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && !empQ.isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sin resultados.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null) }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Empleado {selected?.no_empleado} — {selected?.nombre} {selected?.apellido}</DialogTitle></DialogHeader>
          {selected && (
            <SdnEmpleadoDetalle noCia={selected.no_cia} noEmpleado={selected.no_empleado} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SdnEmpleadoDetalle({ noCia, noEmpleado }: { noCia: string; noEmpleado: number }) {
  const q = useQuery({ queryKey: ['sdn-emp', noCia, noEmpleado], queryFn: () => api.sdnGetEmpleado(noCia, noEmpleado) })
  if (q.isLoading) return <div className="text-muted-foreground">Cargando…</div>
  if (!q.data) return null
  const d: any = q.data
  const field = (l: string, v: any) => <div><span className="text-muted-foreground">{l}:</span> {v ?? '—'}</div>
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      {field('Cédula', d.cedula)}
      {field('Nómina', d.nomina)}
      {field('Centro Trabajo', d.centro_trabajo)}
      {field('Estado civil', d.estado_civil)}
      {field('Fecha ingreso', fmtDate(d.fecha_ingreso))}
      {field('Fecha egreso', fmtDate(d.fecha_egreso))}
      {field('Fecha nacim.', fmtDate(d.fecha_nacimiento))}
      {field('Fijo', d.empleado_fijo)}
      {field('Email', d.email1)}
      {field('Teléfono', d.telefono1 || d.telefono)}
      {field('Ciudad', d.ciudad)}
      {field('Dirección', d.direccion)}
    </div>
  )
}
