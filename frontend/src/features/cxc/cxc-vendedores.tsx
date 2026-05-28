// FCXC107 — Mantenimiento de Vendedores (more fields than simple catalogs)
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'

interface P { noCia: string }

interface Vendedor {
  vendedor: string; nombre: string; flota: string; email: string
  cuota: number; supervisor: string; tipo_vendedor: string; clase: string
  activo: string; nombre_supervisor?: string
}

const BLANK: Omit<Vendedor, 'nombre_supervisor'> = {
  vendedor: '', nombre: '', flota: '', email: '', cuota: 0,
  supervisor: '', tipo_vendedor: 'PREVENTA', clase: '', activo: 'S'
}

export function CxcVendedores({ noCia }: P) {
  const [rows, setRows] = useState<Vendedor[]>([])
  const [supervisores, setSupervisores] = useState<any[]>([])
  const [form, setForm] = useState<any>({ ...BLANK })
  const [open, setOpen] = useState(false)
  const [isNew, setIsNew] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [vend, sups] = await Promise.all([
      regalGeneralApi.cxcListVendedores(noCia),
      regalGeneralApi.cxcListSupervisores(noCia),
    ])
    setRows(vend)
    setSupervisores(sups)
  }, [noCia])

  useEffect(() => { load() }, [load])

  const openNew = () => { setForm({ ...BLANK }); setIsNew(true); setError(''); setOpen(true) }
  const openEdit = (r: Vendedor) => { setForm({ ...r }); setIsNew(false); setError(''); setOpen(true) }

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true); setError('')
    try {
      await regalGeneralApi.cxcSaveVendedor({ ...form, no_cia: noCia })
      setOpen(false); load()
    } catch (e: any) { setError(e?.message || 'Error') } finally { setSaving(false) }
  }

  const del = async (r: Vendedor) => {
    if (!confirm(`¿Eliminar vendedor ${r.vendedor} — ${r.nombre}?`)) return
    await regalGeneralApi.cxcDeleteVendedor(noCia, r.vendedor)
    load()
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">FCXC107 — Mantenimiento de Vendedores</h1>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />Nuevo</Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Flota</TableHead>
              <TableHead>Supervisor</TableHead>
              <TableHead className="w-28">Tipo</TableHead>
              <TableHead className="w-24">Cuota</TableHead>
              <TableHead className="w-20">Estado</TableHead>
              <TableHead className="w-20">Acc.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin vendedores</TableCell></TableRow>
            )}
            {rows.map(r => (
              <TableRow key={r.vendedor}>
                <TableCell className="font-mono">{r.vendedor}</TableCell>
                <TableCell className="font-medium">{r.nombre}</TableCell>
                <TableCell>{r.flota}</TableCell>
                <TableCell>{r.nombre_supervisor || r.supervisor}</TableCell>
                <TableCell>{r.tipo_vendedor}</TableCell>
                <TableCell className="text-right">{Number(r.cuota || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <Badge variant={r.activo === 'S' ? 'default' : 'secondary'}>{r.activo === 'S' ? 'Activo' : 'Inactivo'}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => del(r)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[70vw] max-h-[70vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{isNew ? 'Nuevo' : 'Editar'} Vendedor</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1">
              <Label>Código</Label>
              <Input value={form.vendedor} onChange={e => set('vendedor', e.target.value)} disabled={!isNew} maxLength={10} />
            </div>
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input value={form.nombre} onChange={e => set('nombre', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Flota / Vehículo</Label>
              <Input value={form.flota} onChange={e => set('flota', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Cuota Mensual</Label>
              <Input type="number" value={form.cuota} onChange={e => set('cuota', Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Supervisor</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={form.supervisor || ''} onChange={e => set('supervisor', e.target.value)}>
                <option value="">-- Ninguno --</option>
                {supervisores.map(s => <option key={s.supervisor} value={s.supervisor}>{s.supervisor} — {s.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Tipo Vendedor</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={form.tipo_vendedor || 'PREVENTA'} onChange={e => set('tipo_vendedor', e.target.value)}>
                <option value="PREVENTA">Preventa</option>
                <option value="AUTOVENTA">Autoventa</option>
                <option value="MOSTRADOR">Mostrador</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Clase</Label>
              <Input value={form.clase} onChange={e => set('clase', e.target.value)} maxLength={2} />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" checked={form.activo === 'S'} onChange={e => set('activo', e.target.checked ? 'S' : 'N')} className="h-4 w-4" />
              <Label>Activo</Label>
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
