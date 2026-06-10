import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Pencil, Trash2, Plus } from 'lucide-react'

function YesNoBadge({ value }: { value: string }) {
  const yes = value === 'S' || value === 'A'
  return <span className={yes ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>{yes ? 'Sí' : 'No'}</span>
}

// ---------------- Cias ----------------

function CiasTab() {
  const qc = useQueryClient()
  const { data = [] } = useQuery({ queryKey: ['odc-cias'], queryFn: api.odcListCias })
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ no_cia: '', descripcion: '', activa: 'S', usa_requisicion: 'N' })

  const save = useMutation({
    mutationFn: () => api.odcSaveCia(form),
    onSuccess: () => { toast.success('Empresa guardada'); qc.invalidateQueries({ queryKey: ['odc-cias'] }); setOpen(false) },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error'),
  })

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setForm({ no_cia: '', descripcion: '', activa: 'S', usa_requisicion: 'N' }); setOpen(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Nueva
        </Button>
      </div>
      <div className="rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">No.</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="w-20">Activa</TableHead>
              <TableHead className="w-32">Usa Requisición</TableHead>
              <TableHead className="w-16 text-right">Editar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((r: any) => (
              <TableRow key={r.no_cia}>
                <TableCell className="font-mono">{r.no_cia}</TableCell>
                <TableCell>{r.descripcion}</TableCell>
                <TableCell><YesNoBadge value={r.activa} /></TableCell>
                <TableCell><YesNoBadge value={r.usa_requisicion} /></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setForm(r); setOpen(true) }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Empresa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>No. CIA</Label><Input value={form.no_cia} onChange={(e) => setForm({ ...form, no_cia: e.target.value })} /></div>
            <div><Label>Descripción</Label><Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2"><Checkbox checked={form.activa === 'S'} onCheckedChange={(v) => setForm({ ...form, activa: v ? 'S' : 'N' })} /> Activa</label>
              <label className="flex items-center gap-2"><Checkbox checked={form.usa_requisicion === 'S'} onCheckedChange={(v) => setForm({ ...form, usa_requisicion: v ? 'S' : 'N' })} /> Usa Requisición</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={!form.no_cia || !form.descripcion || save.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------- Puntos ----------------

function PuntosTab() {
  const qc = useQueryClient()
  const { selectedCompany } = useCompany()
  const { data = [] } = useQuery({ queryKey: ['odc-puntos', selectedCompany], queryFn: () => api.odcListPuntos(selectedCompany) })
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>({ no_cia: selectedCompany, punto: '', descripcion: '', activo: 'S', prox_orden: 1, prox_requisicion: 1 })

  const save = useMutation({
    mutationFn: () => api.odcSavePunto(form),
    onSuccess: () => { toast.success('Punto guardado'); qc.invalidateQueries({ queryKey: ['odc-puntos'] }); setOpen(false) },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error'),
  })

  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <div className="text-sm text-muted-foreground">Empresa actual: <b>{selectedCompany}</b></div>
        <Button size="sm" onClick={() => { setForm({ no_cia: selectedCompany, punto: '', descripcion: '', activo: 'S', prox_orden: 1, prox_requisicion: 1 }); setOpen(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo Punto
        </Button>
      </div>
      <div className="rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Punto</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead className="text-right">Próx. Orden</TableHead>
              <TableHead className="text-right">Próx. Requisición</TableHead>
              <TableHead className="text-right">Editar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((r: any) => (
              <TableRow key={r.punto}>
                <TableCell className="font-mono">{r.punto}</TableCell>
                <TableCell>{r.descripcion}</TableCell>
                <TableCell><YesNoBadge value={r.activo} /></TableCell>
                <TableCell className="text-right tabular-nums">{r.prox_orden}</TableCell>
                <TableCell className="text-right tabular-nums">{r.prox_requisicion}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setForm(r); setOpen(true) }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Punto</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>No. CIA</Label><Input value={form.no_cia} onChange={(e) => setForm({ ...form, no_cia: e.target.value })} /></div>
              <div><Label>Punto</Label><Input value={form.punto} onChange={(e) => setForm({ ...form, punto: e.target.value })} /></div>
            </div>
            <div><Label>Descripción</Label><Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Próx. Orden</Label><Input type="number" value={form.prox_orden} onChange={(e) => setForm({ ...form, prox_orden: Number(e.target.value) })} /></div>
              <div><Label>Próx. Requisición</Label><Input type="number" value={form.prox_requisicion} onChange={(e) => setForm({ ...form, prox_requisicion: Number(e.target.value) })} /></div>
            </div>
            <label className="flex items-center gap-2"><Checkbox checked={form.activo === 'S'} onCheckedChange={(v) => setForm({ ...form, activo: v ? 'S' : 'N' })} /> Activo</label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------- Usuarios ----------------

const USR_FLAGS = [
  ['activo', 'Activo'], ['por_defecto', 'Por defecto'],
  ['crear_odc_inv', 'Crear ODC INV'], ['crear_odc_suministro', 'Crear ODC Suministro'],
  ['generar_rep_odc', 'Generar Reporte'], ['imprimir_odc', 'Imprimir'],
  ['reimprimir_odc', 'Reimprimir'], ['anular_odc', 'Anular ODC'],
  ['cerrar_orden', 'Cerrar Orden'],
  ['crear_requisicion', 'Crear Requisición'], ['anular_requisicion', 'Anular Req.'],
  ['cerrar_requisicion', 'Cerrar Req.'], ['autorizar_requisicion', 'Autorizar Req.'],
] as const

function UsuariosTab() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const { data = [] } = useQuery({
    queryKey: ['odc-usuarios', selectedCompany, selectedPoint],
    queryFn: () => api.odcListUsuarios(selectedCompany, selectedPoint),
  })
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>(null)

  const blank = () => Object.fromEntries(USR_FLAGS.map(([k]) => [k, k === 'activo' ? 'S' : 'N']))

  const save = useMutation({
    mutationFn: () => api.odcSaveUsuario({ no_cia: selectedCompany, punto: selectedPoint, ...form }),
    onSuccess: () => { toast.success('Usuario guardado'); qc.invalidateQueries({ queryKey: ['odc-usuarios'] }); setOpen(false) },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error'),
  })

  const del = useMutation({
    mutationFn: (u: string) => api.odcDeleteUsuario(selectedCompany, selectedPoint, u),
    onSuccess: () => { toast.success('Usuario eliminado'); qc.invalidateQueries({ queryKey: ['odc-usuarios'] }) },
  })

  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <div className="text-sm text-muted-foreground">Empresa: <b>{selectedCompany}</b> · Punto: <b>{selectedPoint}</b></div>
        <Button size="sm" onClick={() => { setForm({ usuario: '', ...blank(), monto_minimo: 0, monto_maximo: 0 }); setOpen(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo
        </Button>
      </div>
      <div className="rounded border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead>Crear</TableHead>
              <TableHead>Autorizar</TableHead>
              <TableHead>Anular</TableHead>
              <TableHead className="text-right">Monto Mín.</TableHead>
              <TableHead className="text-right">Monto Máx.</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((u: any) => (
              <TableRow key={u.usuario}>
                <TableCell className="font-mono text-xs">{u.usuario}</TableCell>
                <TableCell><YesNoBadge value={u.activo} /></TableCell>
                <TableCell><YesNoBadge value={u.crear_odc_inv} /></TableCell>
                <TableCell><YesNoBadge value={u.autorizar_requisicion} /></TableCell>
                <TableCell><YesNoBadge value={u.anular_odc} /></TableCell>
                <TableCell className="text-right tabular-nums">{Number(u.monto_minimo || 0).toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(u.monto_maximo || 0).toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setForm(u); setOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => del.mutate(u.usuario)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Permisos de usuario ODC</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div><Label>Usuario</Label><Input value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-2">
                {USR_FLAGS.map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form[k] === 'S'} onCheckedChange={(v) => setForm({ ...form, [k]: v ? 'S' : 'N' })} />
                    {label}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Monto mínimo</Label><Input type="number" value={form.monto_minimo || 0} onChange={(e) => setForm({ ...form, monto_minimo: Number(e.target.value) })} /></div>
                <div><Label>Monto máximo</Label><Input type="number" value={form.monto_maximo || 0} onChange={(e) => setForm({ ...form, monto_maximo: Number(e.target.value) })} /></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={!form?.usuario || save.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function OdcConfig() {
  return (
    <Tabs defaultValue="cias">
      <TabsList>
        <TabsTrigger value="cias">Empresas</TabsTrigger>
        <TabsTrigger value="puntos">Puntos</TabsTrigger>
        <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
      </TabsList>
      <TabsContent value="cias" className="pt-4"><CiasTab /></TabsContent>
      <TabsContent value="puntos" className="pt-4"><PuntosTab /></TabsContent>
      <TabsContent value="usuarios" className="pt-4"><UsuariosTab /></TabsContent>
    </Tabs>
  )
}
