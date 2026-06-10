import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Pencil, Plus } from 'lucide-react'

interface Cia { no_cia: string; descripcion: string; activa: string; usa_requisicion: string }

export function OdcCias() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<Cia[]>({ queryKey: ['odc-cias'], queryFn: api.odcListCias })
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Cia>({ no_cia: '', descripcion: '', activa: 'S', usa_requisicion: 'N' })
  const [editing, setEditing] = useState(false)

  const save = useMutation({
    mutationFn: () => api.odcSaveCia(form as any),
    onSuccess: () => { toast.success('Empresa guardada'); qc.invalidateQueries({ queryKey: ['odc-cias'] }); setOpen(false) },
    onError: (e: any) => toast.error(e?.detail?.error || `Error al guardar empresa`),
  })

  const openNew = () => { setForm({ no_cia: '', descripcion: '', activa: 'S', usa_requisicion: 'N' }); setEditing(false); setOpen(true) }
  const openEdit = (c: Cia) => { setForm(c); setEditing(true); setOpen(true) }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Compañías habilitadas para ODC</h3>
          <p className="text-sm text-muted-foreground">Define qué empresas operan el módulo de Órdenes de Compra y si exigen requisición previa.</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nueva</Button>
      </div>

      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">No. CIA</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Activa</TableHead>
                <TableHead>Usa Requisición</TableHead>
                <TableHead className="text-right">Editar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data || []).map((c) => (
                <TableRow key={c.no_cia}>
                  <TableCell className="font-mono">{c.no_cia}</TableCell>
                  <TableCell>{c.descripcion}</TableCell>
                  <TableCell><Badge variant={c.activa === 'S' ? 'default' : 'secondary'}>{c.activa === 'S' ? 'Sí' : 'No'}</Badge></TableCell>
                  <TableCell><Badge variant={c.usa_requisicion === 'S' ? 'default' : 'outline'}>{c.usa_requisicion === 'S' ? 'Sí' : 'No'}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && (data || []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No hay empresas habilitadas. Usa "Nueva" para crear la primera.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar empresa ODC' : 'Nueva empresa ODC'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>No. CIA <span className="text-destructive">*</span></Label>
              <Input value={form.no_cia} maxLength={2} disabled={editing} onChange={(e) => setForm({ ...form, no_cia: e.target.value.toUpperCase() })} placeholder="01" />
              <p className="text-xs text-muted-foreground mt-1">Código de 2 caracteres único por empresa.</p>
            </div>
            <div>
              <Label>Descripción <span className="text-destructive">*</span></Label>
              <Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="ABREGONZA, SRL" />
            </div>
            <div className="flex gap-6 pt-2">
              <label className="flex items-center gap-2"><Checkbox checked={form.activa === 'S'} onCheckedChange={(v) => setForm({ ...form, activa: v ? 'S' : 'N' })} /> Activa</label>
              <label className="flex items-center gap-2"><Checkbox checked={form.usa_requisicion === 'S'} onCheckedChange={(v) => setForm({ ...form, usa_requisicion: v ? 'S' : 'N' })} /> Usa requisición previa</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={!form.no_cia || !form.descripcion || save.isPending}>
              {save.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
