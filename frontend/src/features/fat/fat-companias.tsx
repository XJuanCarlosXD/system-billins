import { useEffect, useState } from 'react'
import { Building2, FileSpreadsheet, Pencil, Plus, Printer, Save, X } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props { noCia: string }

type Cia = {
  no_cia: string; descripcion: string; direccion: string; rnc: string
  telefono: string; fax: string; impuesto: number; tasa_us: number
  max_descuento: number; activa: boolean; fecha: string | null
}

const emptyForm = {
  no_cia: '', descripcion: '', direccion: '', rnc: '', telefono: '', fax: '',
  impuesto: '18.00', tasa_us: '57.50', max_descuento: '0', activa: true,
}

export function Companias({ noCia }: Props) {
  const [rows, setRows] = useState<Cia[]>([])
  const [loading, setLoading] = useState(false)
  const [edit, setEdit] = useState<Cia | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    regalGeneralApi.fatListCompanias()
      .then((d) => setRows(d.items as Cia[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openEdit = (r: Cia) => {
    setForm({
      no_cia: r.no_cia, descripcion: r.descripcion, direccion: r.direccion,
      rnc: r.rnc, telefono: r.telefono, fax: r.fax,
      impuesto: String(r.impuesto), tasa_us: String(r.tasa_us),
      max_descuento: String(r.max_descuento), activa: r.activa,
    })
    setEdit(r)
  }

  const save = async () => {
    setSaving(true)
    try {
      await regalGeneralApi.fatUpsertCompania({
        no_cia: form.no_cia.trim(), descripcion: form.descripcion.trim(),
        direccion: form.direccion, rnc: form.rnc, telefono: form.telefono, fax: form.fax,
        impuesto: Number(form.impuesto), tasa_us: Number(form.tasa_us),
        max_descuento: Number(form.max_descuento), activa: form.activa,
      })
      setEdit(null); setCreating(false); load()
    } finally { setSaving(false) }
  }

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, '01', '')
    downloadCsv(
    'fat-companias.csv',
    ['No. Cia', 'Descripción', 'RNC', 'Dirección', 'Teléfono', 'ITBIS%', 'Tasa US', 'Activa'],
    rows.map((r) => [r.no_cia, r.descripcion, r.rnc, r.direccion, r.telefono,
                     r.impuesto, r.tasa_us, r.activa ? 'S' : 'N']),
      meta,
    )
  }

  const exportPdf = async () => {
    const meta = await buildReportMeta(noCia, '01', '')
    const win = window.open('', '_blank')!
    win.document.write(`<html><head><title>FFAT101 - Compañías FAT</title>
    <style>body{font-family:Arial,sans-serif;font-size:11px;padding:20px}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:4px 6px}
    th{background:#ddd;font-weight:bold}.hdr{margin-bottom:10px}
    h3{margin:0;font-size:13px}.sub{font-size:10px;color:#666}</style></head><body>
    <div class="hdr"><h3>${meta.empresa}</h3>
    <div class="sub">Sistema de Facturación · Mantenimiento de Compañías · FFAT101</div>
    <div class="sub">Generado: ${meta.fecha}</div></div>
    <table><thead><tr><th>No. Cia</th><th>Descripción</th><th>RNC</th><th>Dirección</th>
    <th>Teléfono</th><th>ITBIS%</th><th>Tasa US</th><th>Activa</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${r.no_cia}</td><td>${r.descripcion}</td><td>${r.rnc}</td>
    <td>${r.direccion}</td><td>${r.telefono}</td><td>${r.impuesto}%</td>
    <td>${r.tasa_us}</td><td>${r.activa ? 'S' : 'N'}</td></tr>`).join('')}
    </tbody></table></body></html>`)
    win.document.close(); win.print()
  }

  const formOpen = !!edit || creating

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <Building2 className='h-5 w-5' /> Mantenimiento de Compañías
          </h2>
          <p className='text-sm text-muted-foreground'>FFAT101 — Configuración de empresas en FAT</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={exportPdf}><Printer className='mr-1 h-4 w-4' /> PDF</Button>
          <Button variant='outline' size='sm' onClick={exportCsv}><FileSpreadsheet className='mr-1 h-4 w-4' /> Excel</Button>
          <Button size='sm' onClick={() => { setForm(emptyForm); setCreating(true) }}>
            <Plus className='mr-1 h-4 w-4' /> Nueva
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-16'>No. Cia</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className='w-28'>RNC</TableHead>
            <TableHead>Dirección</TableHead>
            <TableHead className='w-28'>Teléfono</TableHead>
            <TableHead className='w-20 text-right'>ITBIS%</TableHead>
            <TableHead className='w-24 text-right'>Tasa US</TableHead>
            <TableHead className='w-16 text-center'>Activa</TableHead>
            <TableHead className='w-10' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={9} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={9} className='py-10 text-center text-muted-foreground'>Sin datos.</TableCell></TableRow>}
          {rows.map((row) => (
            <TableRow key={row.no_cia}>
              <TableCell className='font-mono font-semibold'>{row.no_cia}</TableCell>
              <TableCell className='font-medium'>{row.descripcion}</TableCell>
              <TableCell className='font-mono'>{row.rnc}</TableCell>
              <TableCell className='text-sm'>{row.direccion}</TableCell>
              <TableCell>{row.telefono}</TableCell>
              <TableCell className='text-right'>{row.impuesto}%</TableCell>
              <TableCell className='text-right font-mono'>{row.tasa_us}</TableCell>
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

      <Dialog open={formOpen} onOpenChange={() => { setEdit(null); setCreating(false) }}>
        <DialogContent className='max-w-[70vw] max-h-[70vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{creating ? 'Nueva Compañía' : `Editar ${edit?.no_cia} — ${edit?.descripcion}`}</DialogTitle>
          </DialogHeader>
          <div className='grid grid-cols-2 gap-3 text-sm'>
            <div className='space-y-1'>
              <Label className='text-xs'>No. Compañía</Label>
              <Input value={form.no_cia} disabled={!!edit} maxLength={2} className='h-9 font-mono'
                onChange={(e) => setForm((f) => ({ ...f, no_cia: e.target.value.toUpperCase() }))} />
            </div>
            <div className='space-y-1 col-span-2'>
              <Label className='text-xs'>Descripción</Label>
              <Input value={form.descripcion} className='h-9'
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} />
            </div>
            <div className='space-y-1 col-span-2'>
              <Label className='text-xs'>Dirección</Label>
              <Input value={form.direccion} className='h-9'
                onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))} />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>RNC</Label>
              <Input value={form.rnc} className='h-9 font-mono'
                onChange={(e) => setForm((f) => ({ ...f, rnc: e.target.value }))} />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>Teléfono</Label>
              <Input value={form.telefono} className='h-9'
                onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>ITBIS %</Label>
              <Input value={form.impuesto} type='number' className='h-9'
                onChange={(e) => setForm((f) => ({ ...f, impuesto: e.target.value }))} />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>Tasa US</Label>
              <Input value={form.tasa_us} type='number' className='h-9'
                onChange={(e) => setForm((f) => ({ ...f, tasa_us: e.target.value }))} />
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
