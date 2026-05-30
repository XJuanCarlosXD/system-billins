import { useEffect, useState } from 'react'
import { FileSpreadsheet, Pencil, Plus, Printer, Save, X } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv, printCondicionesPago } from './fat-export'

interface Props { noCia: string; punto: string }

type Condicion = {
  no_condicion_pago: string
  descripcion: string
  plazo_pago: number
  porciento: number
  activa: boolean
}

const emptyForm = {
  no_condicion_pago: '',
  descripcion: '',
  plazo_pago: '0',
  porciento: '0',
  activa: true,
}

export function CondicionesPago({ noCia, punto }: Props) {
  const [rows, setRows] = useState<Condicion[]>([])
  const [loading, setLoading] = useState(false)
  const [edit, setEdit] = useState<Condicion | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    regalGeneralApi.fatListCondicionesPago()
      .then((d) => setRows(d.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openEdit = (r: Condicion) => {
    setForm({
      no_condicion_pago: r.no_condicion_pago,
      descripcion: r.descripcion,
      plazo_pago: String(r.plazo_pago),
      porciento: String(r.porciento),
      activa: r.activa,
    })
    setEdit(r)
  }

  const save = async () => {
    setSaving(true)
    try {
      await regalGeneralApi.fatUpsertCondicionPago({
        no_condicion_pago: form.no_condicion_pago.trim().toUpperCase(),
        descripcion: form.descripcion.trim(),
        plazo_pago: Number(form.plazo_pago) || 0,
        porciento: Number(form.porciento) || 0,
        activa: form.activa,
      })
      setEdit(null); setCreating(false); load()
    } finally { setSaving(false) }
  }

  const exportPdf = async () => {
    const meta = await buildReportMeta(noCia, punto, '')
    printCondicionesPago(meta, rows)
  }

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, '')
    downloadCsv(
      'fat-condiciones-pago.csv',
      ['Código', 'Descripción', 'Plazo (días)', '% Dto.Pronto', 'Activa'],
      rows.map((r) => [r.no_condicion_pago, r.descripcion, r.plazo_pago, r.porciento, r.activa ? 'S' : 'N']),
      meta,
    )
  }

  const formOpen = !!edit || creating

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>Condiciones de Pago</h2>
          <p className='text-sm text-muted-foreground'>Catálogo global de plazos y condiciones de pago</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={exportPdf}><Printer className='mr-2 h-4 w-4' /> PDF</Button>
          <Button variant='outline' size='sm' onClick={exportCsv}><FileSpreadsheet className='mr-2 h-4 w-4' /> Excel</Button>
          <Button size='sm' onClick={() => { setForm(emptyForm); setCreating(true) }}>
            <Plus className='mr-2 h-4 w-4' /> Nuevo
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-32'>Código</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className='w-28 text-right'>Plazo (días)</TableHead>
            <TableHead className='w-28 text-right'>% Dto. Pronto</TableHead>
            <TableHead className='w-24 text-center'>Estado</TableHead>
            <TableHead className='w-10' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow><TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>
          )}
          {!loading && rows.length === 0 && (
            <TableRow><TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>No hay condiciones de pago registradas.</TableCell></TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.no_condicion_pago}>
              <TableCell className='font-mono font-semibold'>{row.no_condicion_pago}</TableCell>
              <TableCell>{row.descripcion}</TableCell>
              <TableCell className='text-right'>{row.plazo_pago}</TableCell>
              <TableCell className='text-right'>{row.porciento ? `${row.porciento}%` : '—'}</TableCell>
              <TableCell className='text-center'>
                <Badge variant={row.activa ? 'default' : 'secondary'}>{row.activa ? 'Activa' : 'Inactiva'}</Badge>
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

      <p className='text-xs text-muted-foreground'>Total: {rows.length} condición(es)</p>

      <Dialog open={formOpen} onOpenChange={() => { setEdit(null); setCreating(false) }}>
        <DialogContent className='max-w-[60vw] max-h-[70vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {creating ? 'Nueva Condición de Pago' : `Editar ${edit?.no_condicion_pago} — ${edit?.descripcion}`}
            </DialogTitle>
          </DialogHeader>
          <div className='grid grid-cols-2 gap-3 text-sm'>
            <div className='space-y-1'>
              <Label className='text-xs'>Código</Label>
              <Input value={form.no_condicion_pago} disabled={!!edit} maxLength={4} className='h-9 font-mono'
                onChange={(e) => setForm((f) => ({ ...f, no_condicion_pago: e.target.value.toUpperCase() }))} />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>Estado</Label>
              <Select value={form.activa ? 'S' : 'N'} onValueChange={(v) => setForm((f) => ({ ...f, activa: v === 'S' }))}>
                <SelectTrigger className='h-9'><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='S'>Activa</SelectItem>
                  <SelectItem value='N'>Inactiva</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1 col-span-2'>
              <Label className='text-xs'>Descripción</Label>
              <Input value={form.descripcion} className='h-9'
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>Plazo de Pago (días)</Label>
              <Input value={form.plazo_pago} type='number' min='0' className='h-9'
                onChange={(e) => setForm((f) => ({ ...f, plazo_pago: e.target.value }))} />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>% Descuento Pronto Pago</Label>
              <Input value={form.porciento} type='number' min='0' max='100' step='0.01' className='h-9'
                onChange={(e) => setForm((f) => ({ ...f, porciento: e.target.value }))} />
            </div>
            <div className='col-span-2 flex justify-end gap-2 pt-2'>
              <Button variant='outline' size='sm' onClick={() => { setEdit(null); setCreating(false) }}>
                <X className='mr-1 h-3 w-3' /> Cancelar
              </Button>
              <Button size='sm' onClick={save} disabled={saving || !form.no_condicion_pago || !form.descripcion}>
                <Save className='mr-1 h-3 w-3' /> {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
