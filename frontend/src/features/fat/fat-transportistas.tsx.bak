import { useEffect, useState } from 'react'
import { FileSpreadsheet, Pencil, Plus, Save, Truck, X } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

type Transportista = {
  codigo: number; descripcion: string; direccion: string; celular: string; status: string
}

const emptyForm = { codigo: '', descripcion: '', direccion: '', celular: '', status: 'A' }

export function TransportistasFat() {
  const [rows, setRows] = useState<Transportista[]>([])
  const [loading, setLoading] = useState(false)
  const [edit, setEdit] = useState<Transportista | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    regalGeneralApi.fatListTransportistas()
      .then((d) => setRows(d.items as Transportista[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openEdit = (r: Transportista) => {
    setForm({ codigo: String(r.codigo), descripcion: r.descripcion,
               direccion: r.direccion, celular: r.celular, status: r.status })
    setEdit(r)
  }

  const save = async () => {
    setSaving(true)
    try {
      await regalGeneralApi.fatUpsertTransportista({
        codigo: Number(form.codigo), descripcion: form.descripcion,
        direccion: form.direccion, celular: form.celular, status: form.status,
      })
      setEdit(null); setCreating(false); load()
    } finally { setSaving(false) }
  }

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, '')
    downloadCsv(
    'fat-transportistas.csv',
    ['Código', 'Descripción', 'Dirección', 'Celular', 'Estado'],
    rows.map((r) => [r.codigo, r.descripcion, r.direccion, r.celular, r.status]),
      meta,
    )
  }

  const formOpen = !!edit || creating

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <Truck className='h-5 w-5' /> Transportistas
          </h2>
          <p className='text-sm text-muted-foreground'>FFAT — Mantenimiento de transportistas</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={exportCsv}><FileSpreadsheet className='mr-1 h-4 w-4' /> Excel</Button>
          <Button size='sm' onClick={() => { setForm(emptyForm); setCreating(true) }}>
            <Plus className='mr-1 h-4 w-4' /> Nuevo
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-16'>Código</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Dirección</TableHead>
            <TableHead className='w-32'>Celular</TableHead>
            <TableHead className='w-20 text-center'>Estado</TableHead>
            <TableHead className='w-10' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>No hay transportistas registrados.</TableCell></TableRow>}
          {rows.map((row) => (
            <TableRow key={row.codigo}>
              <TableCell className='font-mono font-semibold'>{row.codigo}</TableCell>
              <TableCell className='font-medium'>{row.descripcion}</TableCell>
              <TableCell className='text-sm'>{row.direccion}</TableCell>
              <TableCell>{row.celular}</TableCell>
              <TableCell className='text-center'>
                <Badge variant={row.status === 'A' ? 'default' : 'secondary'}>{row.status === 'A' ? 'Activo' : 'Inactivo'}</Badge>
              </TableCell>
              <TableCell>
                <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => openEdit(row)}>
                  <Pencil className='h-4 w-4' />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={formOpen} onOpenChange={() => { setEdit(null); setCreating(false) }}>
        <DialogContent className='max-w-sm'>
          <DialogHeader>
            <DialogTitle>{creating ? 'Nuevo Transportista' : `Editar #${edit?.codigo}`}</DialogTitle>
          </DialogHeader>
          <div className='space-y-3 text-sm'>
            <div className='space-y-1'>
              <Label className='text-xs'>Código</Label>
              <Input value={form.codigo} disabled={!!edit} type='number' className='h-9'
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))} />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>Descripción</Label>
              <Input value={form.descripcion} className='h-9'
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>Dirección</Label>
              <Input value={form.direccion} className='h-9'
                onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))} />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>Celular</Label>
              <Input value={form.celular} className='h-9'
                onChange={(e) => setForm((f) => ({ ...f, celular: e.target.value }))} />
            </div>
            <div className='flex justify-end gap-2 pt-2'>
              <Button variant='outline' size='sm' onClick={() => { setEdit(null); setCreating(false) }}>
                <X className='mr-1 h-3 w-3' /> Cancelar
              </Button>
              <Button size='sm' onClick={save} disabled={saving}>
                <Save className='mr-1 h-3 w-3' /> {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
