import { useEffect, useState } from 'react'
import { CreditCard, FileSpreadsheet, Pencil, Plus, Save, X } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props { noCia: string; punto: string }

type TipoPago = { tipo_pago: string; tipo_pago_fiscal: string; descripcion: string }

const emptyForm = { tipo_pago: '', tipo_pago_fiscal: '', descripcion: '' }

export function TiposPagoFat({ noCia, punto }: Props) {
  const [rows, setRows] = useState<TipoPago[]>([])
  const [loading, setLoading] = useState(false)
  const [edit, setEdit] = useState<TipoPago | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = () => {
    if (!noCia) return
    setLoading(true)
    regalGeneralApi.fatListTiposPago(noCia, punto)
      .then((d) => setRows(d.items as TipoPago[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [noCia, punto])

  const openEdit = (r: TipoPago) => {
    setForm({ tipo_pago: r.tipo_pago, tipo_pago_fiscal: r.tipo_pago_fiscal, descripcion: r.descripcion })
    setEdit(r)
  }

  const save = async () => {
    setSaving(true)
    try {
      await regalGeneralApi.fatUpsertTipoPago({
        no_cia: noCia,
        punto,
        tipo_pago: form.tipo_pago.trim(),
        tipo_pago_fiscal: form.tipo_pago_fiscal.trim() || form.tipo_pago.trim(),
        descripcion: form.descripcion.trim(),
      })
      setEdit(null); setCreating(false); load()
    } finally { setSaving(false) }
  }

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, '')
    downloadCsv(
      'fat-tipos-pago.csv',
      ['Tipo Pago', 'Tipo Fiscal', 'Descripción'],
      rows.map((r) => [r.tipo_pago, r.tipo_pago_fiscal, r.descripcion]),
      meta,
    )
  }

  const formOpen = !!edit || creating

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <CreditCard className='h-5 w-5' /> Mantenimiento Tipos Pagos Fiscales
          </h2>
          <p className='text-sm text-muted-foreground'>FFAT137 — Empresa {noCia} · Punto {punto}</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={exportCsv}>
            <FileSpreadsheet className='mr-1 h-4 w-4' /> Excel
          </Button>
          <Button size='sm' onClick={() => { setForm(emptyForm); setCreating(true) }}>
            <Plus className='mr-1 h-4 w-4' /> Nuevo
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-24'>Tipo Pago</TableHead>
            <TableHead className='w-24'>Tipo Fiscal</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className='w-10' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={4} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={4} className='py-10 text-center text-muted-foreground'>No hay tipos de pago configurados.</TableCell></TableRow>}
          {rows.map((row) => (
            <TableRow key={row.tipo_pago}>
              <TableCell className='font-mono font-semibold'>{row.tipo_pago}</TableCell>
              <TableCell className='font-mono'>{row.tipo_pago_fiscal}</TableCell>
              <TableCell>{row.descripcion}</TableCell>
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
        <DialogContent className='max-w-[50vw] max-h-[70vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{creating ? 'Nuevo Tipo de Pago' : `Editar Tipo ${edit?.tipo_pago}`}</DialogTitle>
          </DialogHeader>
          <div className='space-y-3 text-sm'>
            <div className='space-y-1'>
              <Label className='text-xs'>Tipo de Pago (código)</Label>
              <Input value={form.tipo_pago} disabled={!!edit} maxLength={5} className='h-9 font-mono'
                onChange={(e) => setForm((f) => ({ ...f, tipo_pago: e.target.value }))} />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>Tipo Pago Fiscal (código DGI)</Label>
              <Input value={form.tipo_pago_fiscal} maxLength={5} className='h-9 font-mono'
                placeholder='Igual al tipo de pago si no aplica'
                onChange={(e) => setForm((f) => ({ ...f, tipo_pago_fiscal: e.target.value }))} />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>Descripción</Label>
              <Input value={form.descripcion} className='h-9'
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} />
            </div>
            <div className='flex justify-end gap-2 pt-2'>
              <Button variant='outline' size='sm' onClick={() => { setEdit(null); setCreating(false) }}>
                <X className='mr-1 h-3 w-3' /> Cancelar
              </Button>
              <Button size='sm' onClick={save} disabled={saving || !form.tipo_pago || !form.descripcion}>
                <Save className='mr-1 h-3 w-3' /> {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
