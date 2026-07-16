// CxP — FCXP103 Acceso de Usuarios al Módulo
// CRUD sobre TCXP_USUARIO con flags por permiso.
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, RefreshCw, Search } from 'lucide-react'
import { regalGeneralApi as api } from '@/lib/regal-general-api'

interface P { noCia: string; punto?: string }

const FLAGS: Array<{ key: string; label: string }> = [
  { key: 'activo', label: 'Activo' },
  { key: 'por_defecto', label: 'Por defecto' },
  { key: 'hacer_transacciones', label: 'Hacer transacciones' },
  { key: 'generar_listado_cxp', label: 'Generar listado CxP' },
  { key: 'crear_proveedor', label: 'Crear proveedor' },
  { key: 'asignar_proveedor', label: 'Asignar proveedor' },
  { key: 'asignar_cuenta_bancaria', label: 'Asignar cuenta bancaria' },
  { key: 'liberar_debito', label: 'Liberar débito' },
  { key: 'bloquear_pago', label: 'Bloquear pago' },
  { key: 'hacer_cierre', label: 'Hacer cierre' },
]

const emptyForm = (noCia: string, punto: string) => ({
  no_cia: noCia,
  punto,
  usuario: '',
  ...Object.fromEntries(FLAGS.map(f => [f.key, 'N'])),
} as Record<string, string>)

export function CxpUsuarios({ noCia, punto = '' }: P) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState<Record<string, string>>(emptyForm(noCia, punto))
  const [saving, setSaving] = useState(false)

  const cargar = async () => {
    setLoading(true)
    try { setRows(await api.cxpListUsuarios(noCia, punto)) }
    catch (e: any) { toast.error(e?.message || 'Error cargando usuarios') }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noCia, punto])

  const openNew = () => {
    setEditing(null)
    setForm({ ...emptyForm(noCia, punto), activo: 'S' })
    setOpen(true)
  }

  const openEdit = (row: any) => {
    setEditing(row)
    setForm({ ...emptyForm(noCia, punto), ...row })
    setOpen(true)
  }

  const onSave = async () => {
    if (!form.usuario) return toast.error('Usuario requerido')
    if (!form.no_cia || !form.punto) return toast.error('Compañía y punto requeridos')
    setSaving(true)
    try {
      await api.cxpSaveUsuario(form)
      toast.success(editing ? 'Actualizado' : 'Creado')
      setOpen(false)
      cargar()
    } catch (e: any) { toast.error(e?.message || 'Error guardando') }
    finally { setSaving(false) }
  }

  const onDelete = async (row: any) => {
    if (!confirm(`¿Eliminar acceso de ${row.usuario}?`)) return
    try {
      await api.cxpDeleteUsuario(row.no_cia, row.punto, row.usuario)
      toast.success('Eliminado')
      cargar()
    } catch (e: any) { toast.error(e?.message || 'Error eliminando') }
  }

  const filtered = rows.filter((r: any) => {
    if (!search) return true
    return String(r.usuario || '').toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className='p-6 space-y-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold'>FCXP103 — Acceso de Usuarios al Módulo</h1>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={cargar}>
            <RefreshCw className='h-4 w-4 mr-1' /> Actualizar
          </Button>
          <Button size='sm' onClick={openNew}>
            <Plus className='h-4 w-4 mr-1' /> Nuevo
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className='pt-6'>
          <div className='flex gap-3 items-end mb-3'>
            <div className='space-y-1'>
              <Label className='text-xs'>Buscar</Label>
              <div className='relative'>
                <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
                <Input value={search} onChange={e => setSearch(e.target.value)} className='h-9 pl-8 w-64' placeholder='usuario…' />
              </div>
            </div>
            <div className='text-sm text-muted-foreground ml-auto'>
              {filtered.length} de {rows.length} accesos
            </div>
          </div>
          <div className='border rounded-lg overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cía</TableHead>
                  <TableHead>Punto</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead>Permisos</TableHead>
                  <TableHead className='text-right w-32'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={6} className='text-center py-6'>Cargando…</TableCell></TableRow>}
                {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className='text-center py-6 text-muted-foreground'>Sin accesos</TableCell></TableRow>}
                {filtered.map((r: any) => {
                  const granted = FLAGS.filter(f => f.key !== 'activo' && f.key !== 'por_defecto' && r[f.key] === 'S')
                  return (
                    <TableRow key={`${r.no_cia}-${r.punto}-${r.usuario}`}>
                      <TableCell className='font-mono text-sm'>{r.no_cia}</TableCell>
                      <TableCell className='font-mono text-sm'>{r.punto}</TableCell>
                      <TableCell className='font-mono text-sm font-semibold'>{r.usuario}</TableCell>
                      <TableCell>
                        {r.activo === 'S'
                          ? <Badge>Activo</Badge>
                          : <Badge variant='outline'>Inactivo</Badge>}
                        {r.por_defecto === 'S' && <Badge variant='secondary' className='ml-1'>Por defecto</Badge>}
                      </TableCell>
                      <TableCell className='text-xs'>
                        <span className='text-muted-foreground'>{granted.length} permisos: </span>
                        {granted.slice(0, 3).map(f => f.label).join(', ')}
                        {granted.length > 3 && '…'}
                      </TableCell>
                      <TableCell className='text-right'>
                        <Button variant='ghost' size='sm' onClick={() => openEdit(r)}>
                          <Pencil className='h-4 w-4' />
                        </Button>
                        <Button variant='ghost' size='sm' onClick={() => onDelete(r)}>
                          <Trash2 className='h-4 w-4 text-red-600' />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='h-auto max-h-[80vh] max-w-2xl overflow-y-auto sm:max-h-[80vh]'>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar acceso' : 'Nuevo acceso'}</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='grid grid-cols-3 gap-3'>
              <div className='space-y-1'>
                <Label className='text-xs'>No. Compañía *</Label>
                <Input value={form.no_cia} disabled={!!editing}
                  onChange={e => setForm(f => ({ ...f, no_cia: e.target.value }))} className='h-9 font-mono' />
              </div>
              <div className='space-y-1'>
                <Label className='text-xs'>Punto *</Label>
                <Input value={form.punto} disabled={!!editing}
                  onChange={e => setForm(f => ({ ...f, punto: e.target.value }))} className='h-9 font-mono' />
              </div>
              <div className='space-y-1'>
                <Label className='text-xs'>Usuario *</Label>
                <Input value={form.usuario} disabled={!!editing}
                  onChange={e => setForm(f => ({ ...f, usuario: e.target.value.toUpperCase() }))} className='h-9 font-mono' />
              </div>
            </div>
            <div>
              <Label className='text-xs mb-2 block'>Permisos</Label>
              <div className='grid grid-cols-2 gap-2 border rounded p-3 bg-muted/20'>
                {FLAGS.map(f => (
                  <label key={f.key} className='flex items-center gap-2 text-sm cursor-pointer'>
                    <Checkbox
                      checked={form[f.key] === 'S'}
                      onCheckedChange={(v) => setForm(s => ({ ...s, [f.key]: v ? 'S' : 'N' }))}
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
