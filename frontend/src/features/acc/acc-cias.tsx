import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Pencil, Plus } from 'lucide-react'

export function AccCias() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<any[]>({ queryKey: ['acc-cias'], queryFn: api.accListCias })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({ no_cia: '', descripcion: '', registro_cont: 'N', activa: 'S' })

  const save = useMutation({
    mutationFn: () => api.accSaveCia(form),
    onSuccess: () => { toast.success('Empresa guardada'); qc.invalidateQueries({ queryKey: ['acc-cias'] }); setOpen(false) },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error al guardar empresa'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Compañías habilitadas para Caja Chica</h3>
          <p className="text-sm text-muted-foreground">Empresas que operan el módulo ACC y si emiten registro contable.</p>
        </div>
        <Button size="sm" onClick={() => { setForm({ no_cia: '', descripcion: '', registro_cont: 'N', activa: 'S' }); setEditing(false); setOpen(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Nueva
        </Button>
      </div>
      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">No. CIA</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Registro contable</TableHead>
                <TableHead>Activa</TableHead>
                <TableHead className="text-right">Editar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data || []).map((c: any) => (
                <TableRow key={c.no_cia}>
                  <TableCell className="font-mono">{c.no_cia}</TableCell>
                  <TableCell>{c.descripcion}</TableCell>
                  <TableCell><Badge variant={c.registro_cont === 'S' ? 'default' : 'outline'}>{c.registro_cont === 'S' ? 'Sí' : 'No'}</Badge></TableCell>
                  <TableCell><Badge variant={c.activa === 'S' ? 'default' : 'secondary'}>{c.activa === 'S' ? 'Sí' : 'No'}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setForm(c); setEditing(true); setOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && (data || []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sin empresas habilitadas.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar empresa' : 'Nueva empresa'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>No. CIA <span className="text-destructive">*</span></Label>
              <Input maxLength={2} value={form.no_cia} disabled={editing} onChange={(e) => setForm({ ...form, no_cia: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <Label>Descripción <span className="text-destructive">*</span></Label>
              <Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </div>
            <div className="flex gap-4 pt-1">
              <label className="flex items-center gap-2"><Checkbox checked={form.activa === 'S'} onCheckedChange={(v) => setForm({ ...form, activa: v ? 'S' : 'N' })} /> Activa</label>
              <label className="flex items-center gap-2"><Checkbox checked={form.registro_cont === 'S'} onCheckedChange={(v) => setForm({ ...form, registro_cont: v ? 'S' : 'N' })} /> Registro contable</label>
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
