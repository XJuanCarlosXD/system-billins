import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { downloadCsv } from '@/lib/csv-utils'

interface Proveedor {
  no_proveedor: string; nombre: string; rnc: string; cedula: string
  telefono: string; celular: string; e_mail: string; direccion: string
  plazo_pago: number; activo: string; excento_itbis: string
  categoria: string; clasificacion: string
  cuenta_banco: string; codigo_banco: string; tipo_cuenta: string
}

const EMPTY: Proveedor = {
  no_proveedor: '', nombre: '', rnc: '', cedula: '',
  telefono: '', celular: '', e_mail: '', direccion: '',
  plazo_pago: 0, activo: 'S', excento_itbis: 'N',
  categoria: '', clasificacion: '', cuenta_banco: '', codigo_banco: '', tipo_cuenta: '',
}

const PAGE = 50

export function CxpProveedores() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [soloActivos, setSoloActivos] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Proveedor>(EMPTY)
  const [page, setPage] = useState(1)

  const { data = [], isLoading, isError } = useQuery<Proveedor[]>({
    queryKey: ['cxp-proveedores', search, soloActivos],
    queryFn: () => api.cxpListProveedores({ search, activo: soloActivos ? 'S' : '' }),
    staleTime: 60_000,
  })

  const save = useMutation({
    mutationFn: (d: Proveedor) => api.cxpSaveProveedor(d as Record<string, unknown>),
    onSuccess: () => {
      toast.success('Proveedor guardado')
      qc.invalidateQueries({ queryKey: ['cxp-proveedores'] })
      setOpen(false)
    },
    onError: () => toast.error('Error al guardar proveedor'),
  })

  const totalPages = Math.max(1, Math.ceil(data.length / PAGE))
  const slice = data.slice((page - 1) * PAGE, page * PAGE)

  function openNew() { setForm(EMPTY); setOpen(true) }
  function openEdit(p: Proveedor) { setForm({ ...p }); setOpen(true) }
  function set(k: keyof Proveedor, v: string | number) { setForm(f => ({ ...f, [k]: v })) }

  function exportExcel() {
    downloadCsv(data.map(r => ({
      No: r.no_proveedor, Nombre: r.nombre, RNC: r.rnc,
      Teléfono: r.telefono, Correo: r.e_mail, Activo: r.activo,
    })), 'cxp-proveedores.csv')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          <Input
            placeholder="Buscar nombre o RNC…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-60"
          />
          <Button variant="outline" size="sm" onClick={() => setSoloActivos(v => !v)}>
            {soloActivos ? 'Solo activos' : 'Todos'}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel}>Excel</Button>
          <Button size="sm" onClick={openNew}>+ Nuevo</Button>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>RNC / Cédula</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead className="text-right">Plazo</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
            ) : isError ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-red-500">Error al cargar proveedores. Intente nuevamente.</TableCell></TableRow>
            ) : slice.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sin resultados</TableCell></TableRow>
            ) : slice.map(p => (
              <TableRow key={p.no_proveedor} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(p)}>
                <TableCell className="font-mono text-xs">{p.no_proveedor}</TableCell>
                <TableCell>{p.nombre}</TableCell>
                <TableCell className="font-mono text-xs">{p.rnc || p.cedula}</TableCell>
                <TableCell>{p.telefono}</TableCell>
                <TableCell className="text-right">{p.plazo_pago}d</TableCell>
                <TableCell>
                  <Badge className={p.activo === 'S' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                    {p.activo === 'S' ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm items-center">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <span>Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[70vw] max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.no_proveedor ? `Proveedor ${form.no_proveedor}` : 'Nuevo Proveedor'}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="general">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="fiscal">Datos Fiscales</TabsTrigger>
              <TabsTrigger value="banco">Cuenta Bancaria</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label>Nombre *</Label>
                  <Input value={form.nombre} onChange={e => set('nombre', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Teléfono</Label>
                  <Input value={form.telefono} onChange={e => set('telefono', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Celular</Label>
                  <Input value={form.celular} onChange={e => set('celular', e.target.value)} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Dirección</Label>
                  <Input value={form.direccion} onChange={e => set('direccion', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Correo</Label>
                  <Input value={form.e_mail} onChange={e => set('e_mail', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Plazo de Pago (días)</Label>
                  <Input type="number" value={form.plazo_pago} onChange={e => set('plazo_pago', +e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Estado</Label>
                  <select className="w-full border rounded px-3 py-2 text-sm" value={form.activo} onChange={e => set('activo', e.target.value)}>
                    <option value="S">Activo</option>
                    <option value="N">Inactivo</option>
                  </select>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="fiscal" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>RNC</Label><Input value={form.rnc} onChange={e => set('rnc', e.target.value)} /></div>
                <div className="space-y-1"><Label>Cédula</Label><Input value={form.cedula} onChange={e => set('cedula', e.target.value)} /></div>
                <div className="space-y-1"><Label>Categoría</Label><Input value={form.categoria} onChange={e => set('categoria', e.target.value)} /></div>
                <div className="space-y-1"><Label>Clasificación</Label><Input value={form.clasificacion} onChange={e => set('clasificacion', e.target.value)} /></div>
                <div className="space-y-1">
                  <Label>Excento ITBIS</Label>
                  <select className="w-full border rounded px-3 py-2 text-sm" value={form.excento_itbis} onChange={e => set('excento_itbis', e.target.value)}>
                    <option value="N">No</option>
                    <option value="S">Sí</option>
                  </select>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="banco" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>No. Cuenta</Label><Input value={form.cuenta_banco} onChange={e => set('cuenta_banco', e.target.value)} /></div>
                <div className="space-y-1"><Label>Código Banco</Label><Input value={form.codigo_banco} onChange={e => set('codigo_banco', e.target.value)} /></div>
                <div className="space-y-1">
                  <Label>Tipo de Cuenta</Label>
                  <select className="w-full border rounded px-3 py-2 text-sm" value={form.tipo_cuenta} onChange={e => set('tipo_cuenta', e.target.value)}>
                    <option value="">—</option>
                    <option value="C">Corriente</option>
                    <option value="A">Ahorros</option>
                  </select>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate(form)} disabled={save.isPending || !form.nombre}>
              {save.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
