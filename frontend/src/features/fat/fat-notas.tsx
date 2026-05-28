import { useEffect, useState } from 'react'
import { FileText, Pencil, Plus, Save, X } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

type Nota = { codigo: number; descripcion: string }

const emptyForm = { codigo: '', descripcion: '' }

export function NotasFat() {
  const [rows, setRows] = useState<Nota[]>([])
  const [loading, setLoading] = useState(false)
  const [edit, setEdit] = useState<Nota | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    regalGeneralApi.fatListNotas()
      .then((d) => setRows(d.items as Nota[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openEdit = (r: Nota) => {
    setForm({ codigo: String(r.codigo), descripcion: r.descripcion })
    setEdit(r)
  }

  const save = async () => {
    setSaving(true)
    try {
      await regalGeneralApi.fatUpsertNota({
        codigo: Number(form.codigo),
        descripcion: form.descripcion,
      })
      setEdit(null); setCreating(false); load()
    } finally { setSaving(false) }
  }

  const formOpen = !!edit || creating

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <FileText className='h-5 w-5' /> Notas Pie de Factura
          </h2>
          <p className='text-sm text-muted-foreground'>FFAT — Mantenimiento de notas para facturas</p>
        </div>
        <Button size='sm' onClick={() => { setForm(emptyForm); setCreating(true) }}>
          <Plus className='mr-1 h-4 w-4' /> Nuevo
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-20'>Código</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className='w-10' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={3} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={3} className='py-10 text-center text-muted-foreground'>No hay notas registradas.</TableCell></TableRow>}
          {rows.map((row) => (
            <TableRow key={row.codigo}>
              <TableCell className='font-mono font-semibold'>{row.codigo}</TableCell>
              <TableCell className='text-sm whitespace-pre-wrap'>{row.descripcion}</TableCell>
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
        <DialogContent className='max-w-[70vw] max-h-[70vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{creating ? 'Nueva Nota' : `Editar Nota #${edit?.codigo}`}</DialogTitle>
          </DialogHeader>
          <div className='space-y-3 text-sm'>
            <div className='space-y-1'>
              <Label className='text-xs'>Código</Label>
              <Input value={form.codigo} disabled={!!edit} type='number' className='h-9'
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))} />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>Descripción / Texto de la nota</Label>
              <Textarea value={form.descripcion} rows={4} className='resize-none text-sm'
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} />
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
