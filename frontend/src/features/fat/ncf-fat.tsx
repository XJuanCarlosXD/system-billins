import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Pencil, Plus, Printer, Save, X } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'
import { printNcf } from '../cnt/export-utils'

interface Props { noCia: string; punto: string; mes: number; ano: number }

type NCFRange = {
  codigo_ncf: string; tipo_ncf_fiscal: string
  ncf_inicial: number; ncf_final: number; prox_ncf: number
  ncf_manual: boolean; ncf_opcional: boolean; cant_min_ncf: number
  disponibles: number; low_stock: boolean; critical: boolean
}

const emptyForm = {
  codigo_ncf: '', tipo_ncf_fiscal: '', ncf_inicial: '',
  ncf_final: '', prox_ncf: '', cant_min_ncf: '50',
  ncf_manual: false, ncf_opcional: false,
}

export function ControlNcf({ noCia, punto, mes, ano }: Props) {
  const [rows, setRows] = useState<NCFRange[]>([])
  const [loading, setLoading] = useState(false)
  const [edit, setEdit] = useState<NCFRange | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    regalGeneralApi.fatNcf(noCia, punto)
      .then((d) => setRows(d.ncf_ranges as NCFRange[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [noCia, punto])

  const openEdit = (r: NCFRange) => {
    setForm({
      codigo_ncf: r.codigo_ncf,
      tipo_ncf_fiscal: r.tipo_ncf_fiscal,
      ncf_inicial: String(r.ncf_inicial),
      ncf_final: String(r.ncf_final),
      prox_ncf: String(r.prox_ncf),
      cant_min_ncf: String(r.cant_min_ncf),
      ncf_manual: r.ncf_manual,
      ncf_opcional: r.ncf_opcional,
    })
    setEdit(r)
  }

  const openCreate = () => {
    setForm(emptyForm)
    setCreating(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      await regalGeneralApi.fatSaveNcfRange({
        no_cia: noCia,
        codigo_ncf: form.codigo_ncf.trim().toUpperCase(),
        tipo_ncf_fiscal: form.tipo_ncf_fiscal.trim().toUpperCase(),
        ncf_inicial: Number(form.ncf_inicial),
        ncf_final: Number(form.ncf_final),
        prox_ncf: Number(form.prox_ncf) || undefined,
        cant_min_ncf: Number(form.cant_min_ncf) || 0,
        ncf_manual: form.ncf_manual,
        ncf_opcional: form.ncf_opcional,
      })
      setEdit(null)
      setCreating(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const exportPdf = async () => {
    const mesAno = `${String(mes).padStart(2, '0')}-${ano}`
    const meta = await buildReportMeta(noCia, punto, mesAno)
    printNcf(meta, rows)
  }

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, mesAno)
    downloadCsv(
      `fat-ncf-${noCia}-${punto}.csv`,
      ['Código', 'Tipo Fiscal', 'Inicial', 'Final', 'Próximo', 'Disponibles', 'Min', 'Manual', 'Opcional'],
      rows.map((r) => [r.codigo_ncf, r.tipo_ncf_fiscal, r.ncf_inicial, r.ncf_final,
        r.prox_ncf, r.disponibles, r.cant_min_ncf, r.ncf_manual ? 'S' : 'N', r.ncf_opcional ? 'S' : 'N']),
      meta,
    )
  }

  const formOpen = !!edit || creating

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>Control de NCF</h2>
          <p className='text-sm text-muted-foreground'>Empresa {noCia} · Punto {punto} — Secuencias de comprobantes fiscales</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={exportPdf}><Printer className='mr-2 h-4 w-4' /> PDF</Button>
          <Button variant='outline' size='sm' onClick={exportCsv}><FileSpreadsheet className='mr-2 h-4 w-4' /> Excel</Button>
          <Button size='sm' onClick={openCreate}><Plus className='mr-2 h-4 w-4' /> Nuevo Rango</Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-24'>Código NCF</TableHead>
            <TableHead>Tipo Fiscal</TableHead>
            <TableHead className='w-24 text-right'>Inicial</TableHead>
            <TableHead className='w-24 text-right'>Final</TableHead>
            <TableHead className='w-24 text-right'>Próximo</TableHead>
            <TableHead className='w-24 text-right'>Disponibles</TableHead>
            <TableHead className='w-16 text-right'>Mínimo</TableHead>
            <TableHead className='w-24 text-center'>Estado</TableHead>
            <TableHead className='w-10'></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow><TableCell colSpan={9} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>
          )}
          {!loading && rows.length === 0 && (
            <TableRow><TableCell colSpan={9} className='py-10 text-center text-muted-foreground'>No hay rangos NCF registrados.</TableCell></TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.codigo_ncf}>
              <TableCell className='font-mono font-semibold'>{row.codigo_ncf}</TableCell>
              <TableCell>{row.tipo_ncf_fiscal}</TableCell>
              <TableCell className='text-right font-mono'>{row.ncf_inicial.toLocaleString('en-US')}</TableCell>
              <TableCell className='text-right font-mono'>{row.ncf_final.toLocaleString('en-US')}</TableCell>
              <TableCell className='text-right font-mono'>{row.prox_ncf.toLocaleString('en-US')}</TableCell>
              <TableCell className='text-right'>
                <Badge variant={row.critical ? 'destructive' : row.low_stock ? 'secondary' : 'outline'}>
                  {row.disponibles.toLocaleString('en-US')}
                </Badge>
              </TableCell>
              <TableCell className='text-right'>{row.cant_min_ncf}</TableCell>
              <TableCell className='text-center'>
                {row.critical ? (
                  <div className='flex items-center justify-center gap-1 text-destructive'>
                    <AlertTriangle className='h-4 w-4' /><span className='text-xs'>Crítico</span>
                  </div>
                ) : row.low_stock ? (
                  <div className='flex items-center justify-center gap-1 text-muted-foreground'>
                    <AlertTriangle className='h-4 w-4' /><span className='text-xs'>Bajo stock</span>
                  </div>
                ) : (
                  <div className='flex items-center justify-center gap-1 text-primary'>
                    <CheckCircle2 className='h-4 w-4' /><span className='text-xs'>OK</span>
                  </div>
                )}
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
            <DialogTitle>{creating ? 'Nuevo Rango NCF' : `Editar ${edit?.codigo_ncf}`}</DialogTitle>
          </DialogHeader>
          <div className='space-y-3 text-sm'>
            <div className='space-y-1'>
              <label className='text-xs font-medium'>Código NCF</label>
              <Input value={form.codigo_ncf} disabled={!!edit}
                onChange={(e) => setForm((f) => ({ ...f, codigo_ncf: e.target.value.toUpperCase() }))}
                className='h-9 font-mono' maxLength={10} />
            </div>
            <div className='space-y-1'>
              <label className='text-xs font-medium'>Tipo NCF Fiscal</label>
              <Input value={form.tipo_ncf_fiscal}
                onChange={(e) => setForm((f) => ({ ...f, tipo_ncf_fiscal: e.target.value.toUpperCase() }))}
                className='h-9 font-mono' placeholder='B01, B02, E31...' />
            </div>
            <div className='grid grid-cols-2 gap-2'>
              <div className='space-y-1'>
                <label className='text-xs font-medium'>NCF Inicial</label>
                <Input value={form.ncf_inicial} onChange={(e) => setForm((f) => ({ ...f, ncf_inicial: e.target.value }))} className='h-9' type='number' />
              </div>
              <div className='space-y-1'>
                <label className='text-xs font-medium'>NCF Final</label>
                <Input value={form.ncf_final} onChange={(e) => setForm((f) => ({ ...f, ncf_final: e.target.value }))} className='h-9' type='number' />
              </div>
            </div>
            <div className='grid grid-cols-2 gap-2'>
              <div className='space-y-1'>
                <label className='text-xs font-medium'>Próximo NCF</label>
                <Input value={form.prox_ncf} onChange={(e) => setForm((f) => ({ ...f, prox_ncf: e.target.value }))} className='h-9' type='number' />
              </div>
              <div className='space-y-1'>
                <label className='text-xs font-medium'>Mínimo alerta</label>
                <Input value={form.cant_min_ncf} onChange={(e) => setForm((f) => ({ ...f, cant_min_ncf: e.target.value }))} className='h-9' type='number' />
              </div>
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
