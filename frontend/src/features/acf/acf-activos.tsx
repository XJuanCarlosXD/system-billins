import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Eye, Search } from 'lucide-react'

const fmtDate = (s: any) => s ? String(s).slice(0, 10) : ''

export function AcfActivos() {
  const { selectedCompany, selectedPoint } = useCompany()
  const [f, setF] = useState({ search: '', status: '', grupo: '' })
  const [sel, setSel] = useState<any | null>(null)

  const resQ = useQuery({ queryKey: ['acf-res', selectedCompany, selectedPoint], queryFn: () => api.acfRepResumen(selectedCompany, selectedPoint) })
  const grpQ = useQuery({ queryKey: ['acf-grp', selectedCompany], queryFn: () => api.acfRepPorGrupo(selectedCompany) })
  const listQ = useQuery({
    queryKey: ['acf-act', selectedCompany, selectedPoint, f],
    queryFn: () => api.acfListActivos({
      no_cia: selectedCompany, punto: selectedPoint,
      search: f.search || undefined,
      status: f.status || undefined,
      grupo: f.grupo || undefined,
      limit: 500,
    }),
  })
  const r: any = resQ.data || {}
  const rows = listQ.data || []
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total activos</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{r.total ?? '—'}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Activos</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-emerald-600">{r.activos ?? '—'}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Retirados</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-muted-foreground">{r.retirados ?? '—'}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Sin retirar</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{r.sin_retirar ?? '—'}</CardContent></Card>
      </div>

      <div className="flex items-end gap-3">
        <div><Label className="text-xs">Buscar</Label><Input className="w-64 h-9" placeholder="Descripción / código / serie…" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} /></div>
        <div><Label className="text-xs">Status</Label><Input className="w-24 h-9" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} placeholder="A/R" /></div>
        <div><Label className="text-xs">Grupo</Label><Input className="w-28 h-9" value={f.grupo} onChange={(e) => setF({ ...f, grupo: e.target.value })} /></div>
        <Button size="sm" variant="outline" onClick={() => listQ.refetch()}><Search className="h-4 w-4 mr-1" /> Buscar</Button>
        <div className="ml-auto text-sm text-muted-foreground">{rows.length} activos</div>
      </div>

      <div className="rounded border overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>No. Activo</TableHead><TableHead>Descripción</TableHead><TableHead>Grupo</TableHead>
            <TableHead>Marca</TableHead><TableHead>Departamento</TableHead>
            <TableHead>Responsable</TableHead><TableHead>F. Compra</TableHead><TableHead>Estado</TableHead>
            <TableHead className="text-right">Ver</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((a: any) => (
              <TableRow key={`${a.punto}-${a.no_activo}`}>
                <TableCell className="font-mono text-xs">{a.no_activo}</TableCell>
                <TableCell className="truncate max-w-md">{a.descripcion}</TableCell>
                <TableCell>{a.grupo}</TableCell>
                <TableCell>{a.marca}</TableCell>
                <TableCell>{a.departamento}</TableCell>
                <TableCell>{a.responsable}</TableCell>
                <TableCell>{fmtDate(a.fecha_compra)}</TableCell>
                <TableCell>
                  {a.fecha_retiro ? <Badge variant="secondary">Retirado</Badge> : <Badge>Activo</Badge>}
                </TableCell>
                <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setSel(a)}><Eye className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Sin activos para esta empresa/punto.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {grpQ.data && grpQ.data.length > 0 && (
        <div>
          <div className="font-medium mb-2">Activos por grupo</div>
          <div className="rounded border max-w-md">
            <Table>
              <TableHeader><TableRow><TableHead>Grupo</TableHead><TableHead className="text-right">Cantidad</TableHead></TableRow></TableHeader>
              <TableBody>
                {grpQ.data.map((g: any) => (
                  <TableRow key={g.grupo}><TableCell>{g.grupo}</TableCell><TableCell className="text-right tabular-nums">{g.cantidad}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={!!sel} onOpenChange={(v) => { if (!v) setSel(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Activo {sel?.no_activo}</DialogTitle></DialogHeader>
          {sel && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2"><span className="text-muted-foreground">Descripción:</span> {sel.descripcion}</div>
              <div><span className="text-muted-foreground">Grupo:</span> {sel.grupo}</div>
              <div><span className="text-muted-foreground">Subgrupo:</span> {sel.subgrupo}</div>
              <div><span className="text-muted-foreground">Tipo:</span> {sel.tipo}</div>
              <div><span className="text-muted-foreground">Marca:</span> {sel.marca}</div>
              <div><span className="text-muted-foreground">Año modelo:</span> {sel.ano_modelo}</div>
              <div><span className="text-muted-foreground">Serie:</span> {sel.serie}</div>
              <div><span className="text-muted-foreground">Responsable:</span> {sel.responsable}</div>
              <div><span className="text-muted-foreground">Departamento:</span> {sel.departamento}</div>
              <div><span className="text-muted-foreground">F. ingreso:</span> {fmtDate(sel.fecha_ingreso)}</div>
              <div><span className="text-muted-foreground">F. compra:</span> {fmtDate(sel.fecha_compra)}</div>
              <div><span className="text-muted-foreground">F. retiro:</span> {fmtDate(sel.fecha_retiro)}</div>
              <div><span className="text-muted-foreground">Duración años:</span> {sel.duracion_ano}</div>
              <div><span className="text-muted-foreground">Proveedor:</span> {sel.no_proveedor}</div>
              <div><span className="text-muted-foreground">Estado:</span> {sel.status}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
