import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Pencil, Plus, Trash2 } from 'lucide-react'

const FLAGS: { key: string; label: string; help: string }[] = [
  { key: 'activo', label: 'Activo', help: 'Permite acceso al módulo' },
  { key: 'por_defecto', label: 'Por defecto', help: 'Empresa/Punto por defecto al login' },
  { key: 'crear_odc_inv', label: 'Crear ODC INV', help: 'Crear órdenes de tipo Inventario' },
  { key: 'crear_odc_suministro', label: 'Crear ODC Suministro', help: 'Crear órdenes de tipo Suministro' },
  { key: 'generar_rep_odc', label: 'Generar reporte', help: 'Imprimir reporte detallado de órdenes' },
  { key: 'imprimir_odc', label: 'Imprimir ODC', help: 'Imprimir orden la primera vez' },
  { key: 'reimprimir_odc', label: 'Reimprimir ODC', help: 'Imprimir copia de orden ya impresa' },
  { key: 'anular_odc', label: 'Anular ODC', help: 'Permite marcar como anulada' },
  { key: 'cerrar_orden', label: 'Cerrar orden', help: 'Cerrar orden tras recepción' },
  { key: 'crear_requisicion', label: 'Crear requisición', help: '' },
  { key: 'anular_requisicion', label: 'Anular requisición', help: '' },
  { key: 'cerrar_requisicion', label: 'Cerrar requisición', help: '' },
  { key: 'autorizar_requisicion', label: 'Autorizar requisición', help: 'Slot 1/2/3 según jerarquía' },
]

export function OdcUsuarios() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()

  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['odc-usuarios', selectedCompany, selectedPoint],
    queryFn: () => api.odcListUsuarios(selectedCompany, selectedPoint),
  })

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>(null)

  const blank = (): any => {
    const o: any = { no_cia: selectedCompany, punto: selectedPoint, usuario: '', monto_minimo: 0, monto_maximo: 0 }
    FLAGS.forEach(f => { o[f.key] = f.key === 'activo' ? 'S' : 'N' })
    return o
  }

  const save = useMutation({
    mutationFn: () => api.odcSaveUsuario(form),
    onSuccess: () => { toast.success('Usuario guardado'); qc.invalidateQueries({ queryKey: ['odc-usuarios'] }); setOpen(false) },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error al guardar permisos'),
  })

  const del = useMutation({
    mutationFn: (u: string) => api.odcDeleteUsuario(selectedCompany, selectedPoint, u),
    onSuccess: () => { toast.success('Usuario eliminado'); qc.invalidateQueries({ queryKey: ['odc-usuarios'] }) },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error al eliminar'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Acceso de usuarios al módulo ODC</h3>
          <p className="text-sm text-muted-foreground">Empresa: <b>{selectedCompany}</b> · Punto: <b>{selectedPoint}</b>. Permisos granulares por usuario.</p>
        </div>
        <Button size="sm" onClick={() => { setForm(blank()); setEditing(false); setOpen(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo
        </Button>
      </div>

      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="rounded border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead>Crear</TableHead>
                <TableHead>Autorizar req.</TableHead>
                <TableHead>Anular</TableHead>
                <TableHead className="text-right">Monto mín.</TableHead>
                <TableHead className="text-right">Monto máx.</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((u: any) => (
                <TableRow key={u.usuario}>
                  <TableCell className="font-mono text-xs">{u.usuario}</TableCell>
                  <TableCell>{u.activo === 'S' ? 'Sí' : 'No'}</TableCell>
                  <TableCell>{u.crear_odc_inv === 'S' ? 'Inv' : ''}{u.crear_odc_suministro === 'S' ? ' Sum' : ''}</TableCell>
                  <TableCell>{u.autorizar_requisicion === 'S' ? 'Sí' : 'No'}</TableCell>
                  <TableCell>{u.anular_odc === 'S' ? 'Sí' : 'No'}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(u.monto_minimo || 0).toLocaleString('es-DO')}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(u.monto_maximo || 0).toLocaleString('es-DO')}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setForm(u); setEditing(true); setOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => del.mutate(u.usuario)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && data.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No hay permisos definidos para este punto.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? 'Editar permisos' : 'Asignar acceso a usuario'}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div>
                <Label>Usuario Oracle <span className="text-destructive">*</span></Label>
                <Input value={form.usuario} disabled={editing} onChange={(e) => setForm({ ...form, usuario: e.target.value.toUpperCase() })} placeholder="USUARIO" />
                <p className="text-xs text-muted-foreground mt-1">Debe coincidir con el usuario en mayúsculas en TCSC.</p>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {FLAGS.map((f) => (
                  <label key={f.key} className="flex items-start gap-2 text-sm" title={f.help}>
                    <Checkbox checked={form[f.key] === 'S'} onCheckedChange={(v) => setForm({ ...form, [f.key]: v ? 'S' : 'N' })} />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <Label>Monto mínimo autorizable</Label>
                  <Input type="number" value={form.monto_minimo || 0} onChange={(e) => setForm({ ...form, monto_minimo: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Monto máximo autorizable</Label>
                  <Input type="number" value={form.monto_maximo || 0} onChange={(e) => setForm({ ...form, monto_maximo: Number(e.target.value) })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={!form?.usuario || save.isPending}>
              {save.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
