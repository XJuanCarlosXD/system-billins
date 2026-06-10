import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Pencil, Plus } from 'lucide-react'

interface Punto { no_cia: string; punto: string; descripcion: string; activo: string; prox_orden: number; prox_requisicion: number }

export function OdcPuntos() {
  const qc = useQueryClient()
  const { selectedCompany } = useCompany()
  const { data, isLoading } = useQuery<Punto[]>({
    queryKey: ['odc-puntos', selectedCompany],
    queryFn: () => api.odcListPuntos(selectedCompany),
  })

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Punto>({ no_cia: selectedCompany, punto: '', descripcion: '', activo: 'S', prox_orden: 1, prox_requisicion: 1 })

  const save = useMutation({
    mutationFn: () => api.odcSavePunto(form as any),
    onSuccess: () => { toast.success('Punto guardado'); qc.invalidateQueries({ queryKey: ['odc-puntos'] }); setOpen(false) },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error al guardar punto'),
  })

  const openNew = () => { setForm({ no_cia: selectedCompany, punto: '', descripcion: '', activo: 'S', prox_orden: 1, prox_requisicion: 1 }); setEditing(false); setOpen(true) }
  const openEdit = (p: Punto) => { setForm(p); setEditing(true); setOpen(true) }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Sucursales / Puntos de trabajo</h3>
          <p className="text-sm text-muted-foreground">Empresa actual: <b>{selectedCompany}</b>. Define puntos operativos y secuencias de órdenes/requisiciones.</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nuevo</Button>
      </div>

      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Punto</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="text-right">Próx. orden</TableHead>
                <TableHead className="text-right">Próx. requisición</TableHead>
                <TableHead className="text-right">Editar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data || []).map((p) => (
                <TableRow key={p.punto}>
                  <TableCell className="font-mono">{p.punto}</TableCell>
                  <TableCell>{p.descripcion}</TableCell>
                  <TableCell><Badge variant={p.activo === 'S' ? 'default' : 'secondary'}>{p.activo === 'S' ? 'Sí' : 'No'}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{p.prox_orden}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.prox_requisicion}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && (data || []).length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Esta empresa aún no tiene puntos definidos.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar punto' : 'Nuevo punto'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>No. CIA</Label>
                <Input value={form.no_cia} disabled />
              </div>
              <div>
                <Label>Punto <span className="text-destructive">*</span></Label>
                <Input maxLength={2} value={form.punto} disabled={editing} onChange={(e) => setForm({ ...form, punto: e.target.value.padStart(2, '0').slice(0, 2) })} placeholder="01" />
              </div>
            </div>
            <div>
              <Label>Descripción <span className="text-destructive">*</span></Label>
              <Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="SUCURSAL PRINCIPAL" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Próxima orden</Label>
                <Input type="number" min={1} value={form.prox_orden} onChange={(e) => setForm({ ...form, prox_orden: Number(e.target.value) })} />
                <p className="text-xs text-muted-foreground mt-1">Siguiente número que asignará el sistema.</p>
              </div>
              <div>
                <Label>Próxima requisición</Label>
                <Input type="number" min={1} value={form.prox_requisicion} onChange={(e) => setForm({ ...form, prox_requisicion: Number(e.target.value) })} />
              </div>
            </div>
            <label className="flex items-center gap-2"><Checkbox checked={form.activo === 'S'} onCheckedChange={(v) => setForm({ ...form, activo: v ? 'S' : 'N' })} /> Activo</label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={!form.punto || !form.descripcion || save.isPending}>
              {save.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
