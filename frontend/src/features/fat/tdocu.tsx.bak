import { useEffect, useState } from 'react'
import { FileSpreadsheet, Pencil, Plus, Printer, Save, X } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv, printTiposDocumento } from './fat-export'

interface Props { noCia: string; punto: string }

type TDoc = {
  no_cia: string; tipo_docu: string; descripcion: string; tipo_transaccion: string
  codigo_ncf: string | null; activo: boolean
  cuenta_contado: string | null; cuenta_propina: string | null
  porciento_propina: number; afecta_cxc: boolean; controlar_formulario: boolean
  almacen: string | null
}

const TIPO_TRANS_LABEL: Record<string, string> = {
  F: 'Crédito (F)', O: 'Contado (O)', C: 'Conduce (C)', A: 'Anulación (A)',
}

const emptyForm = {
  tipo_docu: '', descripcion: '', tipo_transaccion: 'F', codigo_ncf: '', activo: true,
  cuenta_contado: '', cuenta_propina: '', porciento_propina: '0',
  afecta_cxc: false, controlar_formulario: false, almacen: '',
}

export function TiposDocumentoFat({ noCia, punto }: Props) {
  const [rows, setRows] = useState<TDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [edit, setEdit] = useState<TDoc | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    regalGeneralApi.fatListDocumentTypes(noCia, punto)
      .then((d) => setRows(d.items as TDoc[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [noCia])

  const openEdit = (row: TDoc) => {
    setForm({
      tipo_docu: row.tipo_docu, descripcion: row.descripcion,
      tipo_transaccion: row.tipo_transaccion, codigo_ncf: row.codigo_ncf ?? '',
      activo: row.activo, cuenta_contado: row.cuenta_contado ?? '',
      cuenta_propina: row.cuenta_propina ?? '',
      porciento_propina: String(row.porciento_propina ?? 0),
      afecta_cxc: row.afecta_cxc, controlar_formulario: row.controlar_formulario,
      almacen: row.almacen ?? '',
    })
    setEdit(row)
  }

  const save = async () => {
    setSaving(true)
    try {
      await regalGeneralApi.fatSaveDocumentType({
        no_cia: noCia, punto,
        tipo_docu: form.tipo_docu.trim().toUpperCase(),
        descripcion: form.descripcion.trim(),
        tipo_transaccion: form.tipo_transaccion,
        codigo_ncf: form.codigo_ncf.trim() || undefined,
        activo: form.activo,
        cuenta_contado: form.cuenta_contado.trim() || undefined,
        cuenta_propina: form.cuenta_propina.trim() || undefined,
        porciento_propina: Number(form.porciento_propina) || 0,
        afecta_cxc: form.afecta_cxc,
        controlar_formulario: form.controlar_formulario,
        almacen: form.almacen.trim() || undefined,
      })
      setEdit(null); setCreating(false); load()
    } finally { setSaving(false) }
  }

  const exportPdf = async () => {
    const meta = await buildReportMeta(noCia, punto, '')
    printTiposDocumento(meta, rows.map((r) => ({
      tipo_docu: r.tipo_docu, descripcion: r.descripcion,
      tipo_transaccion: r.tipo_transaccion, codigo_ncf: r.codigo_ncf, activo: r.activo,
    })))
  }

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, '')
    downloadCsv(
    `fat-tipos-docu-${noCia}.csv`,
    ['Tipo', 'Descripción', 'Transacción', 'Cód.NCF', 'Cta.Contado', 'Cta.Propina', '%Prop', 'Almacén', 'Afecta CxC', 'Ctrl.Form', 'Activo'],
    rows.map((r) => [r.tipo_docu, r.descripcion, r.tipo_transaccion, r.codigo_ncf ?? '',
                     r.cuenta_contado ?? '', r.cuenta_propina ?? '', r.porciento_propina,
                     r.almacen ?? '', r.afecta_cxc ? 'S' : 'N', r.controlar_formulario ? 'S' : 'N',
                     r.activo ? 'S' : 'N']),
      meta,
    )
  }

  const formOpen = !!edit || creating

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>Tipos de Documento</h2>
          <p className='text-sm text-muted-foreground'>FFAT103 — Empresa {noCia} — Tipos de factura, conduce y anulación</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={exportPdf}><Printer className='mr-2 h-4 w-4' /> PDF</Button>
          <Button variant='outline' size='sm' onClick={exportCsv}><FileSpreadsheet className='mr-2 h-4 w-4' /> Excel</Button>
          <Button size='sm' onClick={() => { setForm(emptyForm); setCreating(true) }}><Plus className='mr-2 h-4 w-4' /> Nuevo</Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-16'>Tipo</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className='w-28'>Transacción</TableHead>
            <TableHead className='w-20'>Cód. NCF</TableHead>
            <TableHead className='w-28'>Cta. Contable</TableHead>
            <TableHead className='w-20 text-center'>Afecta CxC</TableHead>
            <TableHead className='w-20 text-center'>Estado</TableHead>
            <TableHead className='w-10' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>No hay tipos de documento.</TableCell></TableRow>}
          {rows.map((row) => (
            <TableRow key={row.tipo_docu}>
              <TableCell className='font-mono font-semibold'>{row.tipo_docu}</TableCell>
              <TableCell>{row.descripcion}</TableCell>
              <TableCell>{TIPO_TRANS_LABEL[row.tipo_transaccion] ?? row.tipo_transaccion}</TableCell>
              <TableCell className='font-mono text-sm'>{row.codigo_ncf ?? '—'}</TableCell>
              <TableCell className='font-mono text-sm'>{row.cuenta_contado ?? '—'}</TableCell>
              <TableCell className='text-center'>
                <Badge variant={row.afecta_cxc ? 'default' : 'outline'} className='text-xs'>
                  {row.afecta_cxc ? 'Sí' : 'No'}
                </Badge>
              </TableCell>
              <TableCell className='text-center'>
                <Badge variant={row.activo ? 'default' : 'secondary'}>{row.activo ? 'Activo' : 'Inactivo'}</Badge>
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
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>{creating ? 'Nuevo Tipo de Documento' : `Editar ${edit?.tipo_docu} — ${edit?.descripcion}`}</DialogTitle>
          </DialogHeader>
          <div className='grid grid-cols-2 gap-3 text-sm'>
            <div className='space-y-1'>
              <Label className='text-xs'>Tipo (código)</Label>
              <Input value={form.tipo_docu} disabled={!!edit} maxLength={2} className='h-9 font-mono'
                onChange={(e) => setForm((f) => ({ ...f, tipo_docu: e.target.value.toUpperCase() }))} />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>Tipo de Transacción</Label>
              <Select value={form.tipo_transaccion} onValueChange={(v) => setForm((f) => ({ ...f, tipo_transaccion: v }))}>
                <SelectTrigger className='h-9'><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='F'>F — Crédito</SelectItem>
                  <SelectItem value='O'>O — Contado</SelectItem>
                  <SelectItem value='C'>C — Conduce</SelectItem>
                  <SelectItem value='A'>A — Anulación</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1 col-span-2'>
              <Label className='text-xs'>Descripción</Label>
              <Input value={form.descripcion} className='h-9'
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>Código NCF</Label>
              <Input value={form.codigo_ncf} maxLength={10} className='h-9 font-mono'
                onChange={(e) => setForm((f) => ({ ...f, codigo_ncf: e.target.value.toUpperCase() }))} />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>Almacén</Label>
              <Input value={form.almacen} maxLength={4} className='h-9 font-mono'
                onChange={(e) => setForm((f) => ({ ...f, almacen: e.target.value.toUpperCase() }))} />
            </div>

            <div className='col-span-2 border-t pt-2'>
              <p className='text-xs font-semibold text-muted-foreground mb-2'>Cuentas Contables CNT</p>
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>Cuenta Contable (Contado/Crédito)</Label>
              <Input value={form.cuenta_contado} maxLength={20} className='h-9 font-mono'
                placeholder='Ej: 4101-001'
                onChange={(e) => setForm((f) => ({ ...f, cuenta_contado: e.target.value.toUpperCase() }))} />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>Cuenta Propina</Label>
              <Input value={form.cuenta_propina} maxLength={20} className='h-9 font-mono'
                placeholder='Opcional'
                onChange={(e) => setForm((f) => ({ ...f, cuenta_propina: e.target.value.toUpperCase() }))} />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>% Propina</Label>
              <Input value={form.porciento_propina} type='number' min='0' max='100' className='h-9'
                onChange={(e) => setForm((f) => ({ ...f, porciento_propina: e.target.value }))} />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>Estado</Label>
              <Select value={form.activo ? 'S' : 'N'} onValueChange={(v) => setForm((f) => ({ ...f, activo: v === 'S' }))}>
                <SelectTrigger className='h-9'><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='S'>Activo</SelectItem>
                  <SelectItem value='N'>Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='col-span-2 flex gap-6'>
              <div className='flex items-center gap-2'>
                <Checkbox id='afecta_cxc' checked={form.afecta_cxc}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, afecta_cxc: !!v }))} />
                <Label htmlFor='afecta_cxc' className='text-xs cursor-pointer'>Afecta CxC</Label>
              </div>
              <div className='flex items-center gap-2'>
                <Checkbox id='ctrl_form' checked={form.controlar_formulario}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, controlar_formulario: !!v }))} />
                <Label htmlFor='ctrl_form' className='text-xs cursor-pointer'>Controlar Formulario</Label>
              </div>
            </div>

            <div className='col-span-2 flex justify-end gap-2 pt-2'>
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
