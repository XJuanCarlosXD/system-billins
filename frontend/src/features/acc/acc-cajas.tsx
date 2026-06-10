import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Pencil, Plus } from 'lucide-react'

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })

export function AccCajas() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const { data = [] } = useQuery({
    queryKey: ['acc-cajas', selectedCompany, selectedPoint],
    queryFn: () => api.accListCajas(selectedCompany, selectedPoint),
  })
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>(null)

  const save = useMutation({
    mutationFn: () => api.accSaveCaja(form),
    onSuccess: () => { toast.success('Caja guardada'); qc.invalidateQueries({ queryKey: ['acc-cajas'] }); setOpen(false) },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error'),
  })

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">Empresa: <b>{selectedCompany}</b> · Punto: <b>{selectedPoint}</b></div>
        <Button size="sm" onClick={() => { setForm({ no_cia: selectedCompany, punto: selectedPoint, no_caja: '', descripcion: '', cuenta: '', moneda: 'DOP', monto: 0, monto_mayor: 0, activa: 'S', controlar_cc: 'S', reponer_con_dife: 'N' }); setOpen(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Nueva
        </Button>
      </div>
      <div className="rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">No.</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead>NCF</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Activa</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead className="text-right">Editar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((c: any) => (
              <TableRow key={c.no_caja}>
                <TableCell className="font-mono">{c.no_caja}</TableCell>
                <TableCell>{c.descripcion}</TableCell>
                <TableCell className="font-mono text-xs">{c.cuenta}</TableCell>
                <TableCell className="font-mono text-xs">{c.codigo_ncf}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(c.monto)}</TableCell>
                <TableCell>{c.activa === 'S' ? 'Sí' : 'No'}</TableCell>
                <TableCell className="text-xs">{c.usuario}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setForm(c); setOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Caja Chica</DialogTitle></DialogHeader>
          {form && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>No. Caja</Label><Input value={form.no_caja} onChange={(e) => setForm({ ...form, no_caja: e.target.value })} /></div>
              <div><Label>Moneda</Label><Input value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })} /></div>
              <div className="col-span-2"><Label>Descripción</Label><Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
              <div><Label>Cuenta</Label><Input value={form.cuenta} onChange={(e) => setForm({ ...form, cuenta: e.target.value })} /></div>
              <div><Label>Cuenta Prima</Label><Input value={form.cuenta_prima || ''} onChange={(e) => setForm({ ...form, cuenta_prima: e.target.value })} /></div>
              <div><Label>Monto</Label><Input type="number" value={form.monto} onChange={(e) => setForm({ ...form, monto: Number(e.target.value) })} /></div>
              <div><Label>Monto Mayor</Label><Input type="number" value={form.monto_mayor || 0} onChange={(e) => setForm({ ...form, monto_mayor: Number(e.target.value) })} /></div>
              <div><Label>Código NCF</Label><Input value={form.codigo_ncf || ''} onChange={(e) => setForm({ ...form, codigo_ncf: e.target.value })} /></div>
              <div className="col-span-2 flex gap-4">
                <label className="flex items-center gap-2"><Checkbox checked={form.activa === 'S'} onCheckedChange={(v) => setForm({ ...form, activa: v ? 'S' : 'N' })} /> Activa</label>
                <label className="flex items-center gap-2"><Checkbox checked={form.controlar_cc === 'S'} onCheckedChange={(v) => setForm({ ...form, controlar_cc: v ? 'S' : 'N' })} /> Controlar CC</label>
                <label className="flex items-center gap-2"><Checkbox checked={form.reponer_con_dife === 'S'} onCheckedChange={(v) => setForm({ ...form, reponer_con_dife: v ? 'S' : 'N' })} /> Reponer con diferencia</label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={!form?.no_caja || !form?.cuenta || save.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
