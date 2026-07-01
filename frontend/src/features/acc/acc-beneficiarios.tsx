import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'

interface Form {
  no_bene?: string
  tipo_bene: string
  nombre: string
  rnc: string
  activo: string
}

const EMPTY: Form = { no_bene: '', tipo_bene: '', nombre: '', rnc: '', activo: 'S' }

export function AccBeneficiarios() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [activo, setActivo] = useState('S')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Form>(EMPTY)
  const [toDelete, setToDelete] = useState<any | null>(null)

  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['acc-bene', search, activo],
    queryFn: () => api.accListBeneficiarios({ search, activo }),
  })
  const tiposQ = useQuery<any[]>({
    queryKey: ['acc-tbene'], queryFn: () => api.accListTiposBene(),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['acc-bene'] })

  const save = useMutation({
    mutationFn: () => api.accSaveBeneficiario(form as any),
    onSuccess: () => {
      toast.success(editing ? 'Beneficiario actualizado' : 'Beneficiario creado')
      setOpen(false); invalidate()
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error al guardar'),
  })

  const del = useMutation({
    mutationFn: (row: any) => api.accDeleteBeneficiario(row.no_bene),
    onSuccess: () => { toast.success('Beneficiario eliminado'); setToDelete(null); invalidate() },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error al eliminar'),
  })

  const openNew = () => { setForm(EMPTY); setEditing(false); setOpen(true) }
  const openEdit = (r: any) => {
    setForm({
      no_bene: r.no_bene, tipo_bene: r.tipo_bene || '', nombre: r.nombre || '',
      rnc: r.rnc || '', activo: r.activo || 'S',
    })
    setEditing(true); setOpen(true)
  }

  const submit = () => {
    if (!form.tipo_bene || !form.nombre) { toast.error('Tipo y nombre son requeridos'); return }
    save.mutate()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">Beneficiarios</h3>
          <p className="text-sm text-muted-foreground">Personas/entidades que reciben pagos desde caja chica.</p>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nuevo
        </Button>
      </div>
      <div className="flex items-end gap-3">
        <div className="grow max-w-md">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 h-9" placeholder="Nombre / código / RNC…"
                   value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div>
          <Label className="text-xs">Estado</Label>
          <select className="h-9 border rounded px-2 text-sm" value={activo}
                  onChange={(e) => setActivo(e.target.value)}>
            <option value="S">Activos</option>
            <option value="N">Inactivos</option>
            <option value="">Todos</option>
          </select>
        </div>
        <div className="ml-auto text-sm text-muted-foreground">{data.length} beneficiarios</div>
      </div>

      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>RNC/Cédula</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.slice(0, 500).map((b: any) => (
                <TableRow key={b.no_bene}>
                  <TableCell className="font-mono">{b.no_bene}</TableCell>
                  <TableCell>{b.nombre}</TableCell>
                  <TableCell className="text-xs">{b.tipo_bene} — {b.tipo_desc}</TableCell>
                  <TableCell className="font-mono text-xs">{b.rnc}</TableCell>
                  <TableCell>
                    <Badge variant={b.activo === 'S' ? 'default' : 'secondary'}>
                      {b.activo === 'S' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(b)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setToDelete(b)} title="Eliminar">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Sin beneficiarios para el filtro.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar beneficiario' : 'Nuevo beneficiario'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            {editing && (
              <div className="col-span-2">
                <Label className="text-xs">Código</Label>
                <Input className="h-9 font-mono" value={form.no_bene ?? ''} disabled />
              </div>
            )}
            <div>
              <Label className="text-xs">Tipo <span className="text-destructive">*</span></Label>
              <Select value={form.tipo_bene} onValueChange={(v) => setForm({ ...form, tipo_bene: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                <SelectContent>
                  {(tiposQ.data || []).map((t: any) => (
                    <SelectItem key={t.tipo_bene} value={t.tipo_bene}>
                      {t.tipo_bene} — {t.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Estado</Label>
              <Select value={form.activo} onValueChange={(v) => setForm({ ...form, activo: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="S">Activo</SelectItem>
                  <SelectItem value="N">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Nombre <span className="text-destructive">*</span></Label>
              <Input className="h-9" value={form.nombre}
                     onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">RNC / Cédula</Label>
              <Input className="h-9 font-mono" value={form.rnc}
                     onChange={(e) => setForm({ ...form, rnc: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={save.isPending}>
              {save.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar beneficiario?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <span className="font-mono">{toDelete?.no_bene}</span> — {toDelete?.nombre}.
              No se podrá deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && del.mutate(toDelete)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
