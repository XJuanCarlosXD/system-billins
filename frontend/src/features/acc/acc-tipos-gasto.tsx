// ACC — Catálogo Tipos de Gasto con cuenta contable de débito (CRUD).
// Equivale al mantenimiento Facc108 del legado.
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useEnterAdvancesFocus } from '@/hooks/use-enter-advances-focus'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Pencil, Plus, Save } from 'lucide-react'

const EMPTY = { tipo_gasto: '', descripcion: '', cuenta: '', centro_costo: '0000000000', activo: 'S' }

export function AccTiposGasto() {
  const qc = useQueryClient()
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['acc-tgasto'], queryFn: api.accListTiposGasto,
  })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const formRef = useEnterAdvancesFocus<HTMLDivElement>()

  const save = useMutation({
    mutationFn: () => api.accSaveTipoGasto(form),
    onSuccess: () => {
      toast.success(editing ? 'Tipo de gasto actualizado' : 'Tipo de gasto creado')
      qc.invalidateQueries({ queryKey: ['acc-tgasto'] })
      qc.invalidateQueries({ queryKey: ['acc-gasto-pick'] })
      setOpen(false)
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo guardar'),
  })

  const openNew = () => { setForm(EMPTY); setEditing(false); setOpen(true) }
  const openEdit = (r: any) => {
    setForm({
      tipo_gasto: r.tipo_gasto || '',
      descripcion: r.descripcion || '',
      cuenta: r.cuenta || '',
      centro_costo: r.centro_costo || '0000000000',
      activo: r.activo || 'S',
    })
    setEditing(true); setOpen(true)
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Tipos de Gasto</h3>
        <p className="text-sm text-muted-foreground">
          Catálogo de conceptos de gasto con su <b>cuenta contable</b> de débito.
          Equivale a <i>Facc108</i>. Fuente: <code>TACC_TGASTOS</code>.
        </p>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo tipo
        </Button>
      </div>

      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-40">Cuenta contable</TableHead>
                <TableHead className="w-32">Centro costo</TableHead>
                <TableHead className="w-24">Estado</TableHead>
                <TableHead className="w-20 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((g: any) => (
                <TableRow key={g.tipo_gasto}>
                  <TableCell className="font-mono">{g.tipo_gasto}</TableCell>
                  <TableCell>{g.descripcion}</TableCell>
                  <TableCell className="font-mono text-xs">{g.cuenta}</TableCell>
                  <TableCell className="font-mono text-xs">{g.centro_costo}</TableCell>
                  <TableCell>
                    <Badge variant={g.activo === 'S' ? 'default' : 'secondary'}>
                      {g.activo === 'S' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(g)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && data.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  Sin tipos de gasto registrados.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar tipo de gasto' : 'Nuevo tipo de gasto'}</DialogTitle>
          </DialogHeader>
          <div ref={formRef} className="grid grid-cols-2 gap-3 py-2">
            <div>
              <Label className="text-xs">Código <span className="text-destructive">*</span></Label>
              <Input className="h-9 font-mono uppercase" value={form.tipo_gasto}
                disabled={editing}
                onChange={(e) => setForm({ ...form, tipo_gasto: e.target.value.toUpperCase() })}
                placeholder="0001" />
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
              <Label className="text-xs">Descripción <span className="text-destructive">*</span></Label>
              <Input className="h-9" value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Ej. PAPELERÍA Y ÚTILES" />
            </div>
            <div>
              <Label className="text-xs">Cuenta contable <span className="text-destructive">*</span></Label>
              <Input className="h-9 font-mono" value={form.cuenta}
                onChange={(e) => setForm({ ...form, cuenta: e.target.value })}
                placeholder="5102010000" />
              <p className="text-[10px] text-muted-foreground mt-1">
                Cuenta de débito que se carga al registrar el egreso.
              </p>
            </div>
            <div>
              <Label className="text-xs">Centro de costo</Label>
              <Input className="h-9 font-mono" value={form.centro_costo}
                onChange={(e) => setForm({ ...form, centro_costo: e.target.value })}
                placeholder="0000000000" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()}
              disabled={!form.tipo_gasto || !form.descripcion || !form.cuenta || save.isPending}>
              <Save className="h-4 w-4 mr-1" />
              {save.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
