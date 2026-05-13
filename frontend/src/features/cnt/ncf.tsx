import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Pencil, Plus, Printer, Search } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv, printHtml } from './export-utils'

interface Props { noCia: string; punto: string; ano: number; mes: number }

type NcfRow = Record<string, any>

const emptyForm = {
  codigo_ncf: '',
  ncf_inicial: '',
  ncf_final: '',
  tipo_ncf_fiscal: 'NORMAL',
  cant_min_ncf: '50',
  fecha_vencimiento: '',
  ncf_manual: false,
}

export function NcfContabilidad({ noCia, punto }: Props) {
  const [rows, setRows] = useState<NcfRow[]>([])
  const [edit, setEdit] = useState<NcfRow | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const load = () => {
    regalGeneralApi.cntNcf(noCia, punto).then(setRows).catch(() => {})
  }

  useEffect(() => {
    load()
  }, [noCia, punto])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return rows
    return rows.filter((row) =>
      String(row.codigo_ncf || '').toLowerCase().includes(query) ||
      String(row.tipo_ncf_fiscal || '').toLowerCase().includes(query),
    )
  }, [rows, search])

  const pagedRows = useMemo(() => {
    const start = (page - 1) * 12
    return filteredRows.slice(start, start + 12)
  }, [filteredRows, page])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / 12))

  const exportExcel = () => {
    downloadCsv(
      `cnt-ncf-${noCia}-${punto}.csv`,
      ['Codigo', 'Inicial', 'Final', 'Proximo', 'Disponibles', 'Tipo', 'Manual', 'Vencimiento'],
      filteredRows.map((row) => [
        row.codigo_ncf,
        row.ncf_inicial,
        row.ncf_final,
        row.prox_ncf,
        row.disponibles,
        row.tipo_ncf_fiscal,
        row.ncf_manual,
        row.fecha_vencimiento ? String(row.fecha_vencimiento).slice(0, 10) : '',
      ]),
    )
  }

  const exportPdf = () => {
    const body = `
      <table>
        <thead>
          <tr>
            <th>Codigo</th>
            <th>Inicial</th>
            <th>Final</th>
            <th>Proximo</th>
            <th>Disponibles</th>
            <th>Tipo</th>
            <th>Vencimiento</th>
          </tr>
        </thead>
        <tbody>
          ${filteredRows.map((row) => `
            <tr>
              <td>${row.codigo_ncf ?? ''}</td>
              <td class="numeric">${row.ncf_inicial ?? ''}</td>
              <td class="numeric">${row.ncf_final ?? ''}</td>
              <td class="numeric">${row.prox_ncf ?? ''}</td>
              <td class="numeric">${row.disponibles ?? ''}</td>
              <td>${row.tipo_ncf_fiscal ?? ''}</td>
              <td>${row.fecha_vencimiento ? String(row.fecha_vencimiento).slice(0, 10) : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    printHtml(`NCF Contabilidad ${noCia}/${punto}`, body)
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>Mantenimiento NCF</h2>
          <p className='text-sm text-muted-foreground'>La tabla `TCNT_NCF` es global en este legado; por eso aqui se muestran todas las secuencias cargadas.</p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Button variant='outline' size='sm' onClick={exportPdf}>
            <Printer className='mr-2 h-4 w-4' /> PDF
          </Button>
          <Button variant='outline' size='sm' onClick={exportExcel}>
            <FileSpreadsheet className='mr-2 h-4 w-4' /> Excel
          </Button>
          <Button size='sm' onClick={() => setCreateOpen(true)}>
            <Plus className='mr-2 h-4 w-4' /> Nuevo NCF
          </Button>
        </div>
      </div>

      <div className='relative rounded-xl border p-4'>
        <Search className='absolute left-6 top-6 h-4 w-4 text-muted-foreground' />
        <Input
          value={search}
          onChange={(event) => {
            setPage(1)
            setSearch(event.target.value)
          }}
          placeholder='Filtrar NCF...'
          className='h-9 pl-8'
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Codigo NCF</TableHead>
            <TableHead className='text-right'>Inicial</TableHead>
            <TableHead className='text-right'>Final</TableHead>
            <TableHead className='text-right'>Proximo</TableHead>
            <TableHead className='text-right'>Disponibles</TableHead>
            <TableHead>Vencimiento</TableHead>
            <TableHead className='text-center'>Estado</TableHead>
            <TableHead className='w-12 text-right'>Accion</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagedRows.map((row) => (
            <TableRow key={row.codigo_ncf}>
              <TableCell className='font-mono'>{row.codigo_ncf}</TableCell>
              <TableCell className='text-right font-mono'>{row.ncf_inicial}</TableCell>
              <TableCell className='text-right font-mono'>{row.ncf_final}</TableCell>
              <TableCell className='text-right font-mono'>{row.prox_ncf}</TableCell>
              <TableCell className='text-right'>
                <Badge variant={row.critical ? 'destructive' : row.low_stock ? 'secondary' : 'outline'}>
                  {row.disponibles}
                </Badge>
              </TableCell>
              <TableCell>{row.fecha_vencimiento ? String(row.fecha_vencimiento).slice(0, 10) : ''}</TableCell>
              <TableCell className='text-center'>
                {row.critical ? (
                  <AlertTriangle className='mx-auto h-4 w-4 text-destructive' />
                ) : row.low_stock ? (
                  <AlertTriangle className='mx-auto h-4 w-4 text-muted-foreground' />
                ) : (
                  <CheckCircle2 className='mx-auto h-4 w-4 text-primary' />
                )}
              </TableCell>
              <TableCell className='text-right'>
                <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => setEdit(row)}>
                  <Pencil className='h-4 w-4' />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {pagedRows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>
                No hay secuencias NCF para ese filtro.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className='flex items-center justify-between text-sm'>
        <span className='text-muted-foreground'>Pagina {page} de {totalPages}</span>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Anterior</Button>
          <Button variant='outline' size='sm' disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente</Button>
        </div>
      </div>

      {edit && (
        <NcfEditDialog
          noCia={noCia}
          punto={punto}
          row={edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null)
            load()
          }}
        />
      )}
      {createOpen && (
        <NcfCreateDialog
          noCia={noCia}
          punto={punto}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false)
            load()
          }}
        />
      )}
    </section>
  )
}

function NcfEditDialog({
  row,
  noCia,
  punto,
  onClose,
  onSaved,
}: {
  row: NcfRow
  noCia: string
  punto: string
  onClose: () => void
  onSaved: () => void
}) {
  const [ncfFinal, setNcfFinal] = useState(String(row.ncf_final || ''))
  const [cantMin, setCantMin] = useState(String(row.cant_min_ncf || 50))
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await regalGeneralApi.cntUpdateNcf(row.codigo_ncf, {
        no_cia: noCia,
        punto,
        ncf_final: Number(ncfFinal),
        cant_min_ncf: Number(cantMin),
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className='max-w-sm'>
        <DialogHeader>
          <DialogTitle>Editar NCF {row.codigo_ncf}</DialogTitle>
        </DialogHeader>
        <div className='space-y-3 text-sm'>
          <div className='space-y-1'>
            <label className='text-xs font-medium'>NCF final</label>
            <Input value={ncfFinal} onChange={(event) => setNcfFinal(event.target.value)} className='h-9' />
          </div>
          <div className='space-y-1'>
            <label className='text-xs font-medium'>Minimo de alerta</label>
            <Input value={cantMin} onChange={(event) => setCantMin(event.target.value)} className='h-9' />
          </div>
          <div className='flex justify-end gap-2'>
            <Button variant='outline' size='sm' onClick={onClose}>Cancelar</Button>
            <Button size='sm' onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function NcfCreateDialog({
  noCia,
  punto,
  onClose,
  onSaved,
}: {
  noCia: string
  punto: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await regalGeneralApi.cntCreateNcf({
        no_cia: noCia,
        punto,
        codigo_ncf: form.codigo_ncf.trim(),
        ncf_inicial: Number(form.ncf_inicial),
        ncf_final: Number(form.ncf_final),
        tipo_ncf_fiscal: form.tipo_ncf_fiscal.trim() || 'NORMAL',
        cant_min_ncf: Number(form.cant_min_ncf || 50),
        fecha_vencimiento: form.fecha_vencimiento || null,
        ncf_manual: form.ncf_manual ? 'S' : 'N',
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>Nuevo NCF</DialogTitle>
        </DialogHeader>
        <div className='grid gap-3 sm:grid-cols-2'>
          <div className='space-y-1 sm:col-span-2'>
            <label className='text-xs font-medium'>Codigo NCF</label>
            <Input value={form.codigo_ncf} onChange={(event) => setForm((current) => ({ ...current, codigo_ncf: event.target.value }))} />
          </div>
          <div className='space-y-1'>
            <label className='text-xs font-medium'>NCF inicial</label>
            <Input value={form.ncf_inicial} onChange={(event) => setForm((current) => ({ ...current, ncf_inicial: event.target.value }))} />
          </div>
          <div className='space-y-1'>
            <label className='text-xs font-medium'>NCF final</label>
            <Input value={form.ncf_final} onChange={(event) => setForm((current) => ({ ...current, ncf_final: event.target.value }))} />
          </div>
          <div className='space-y-1'>
            <label className='text-xs font-medium'>Tipo fiscal</label>
            <Input value={form.tipo_ncf_fiscal} onChange={(event) => setForm((current) => ({ ...current, tipo_ncf_fiscal: event.target.value }))} />
          </div>
          <div className='space-y-1'>
            <label className='text-xs font-medium'>Minimo alerta</label>
            <Input value={form.cant_min_ncf} onChange={(event) => setForm((current) => ({ ...current, cant_min_ncf: event.target.value }))} />
          </div>
          <div className='space-y-1 sm:col-span-2'>
            <label className='text-xs font-medium'>Vencimiento</label>
            <Input type='date' value={form.fecha_vencimiento} onChange={(event) => setForm((current) => ({ ...current, fecha_vencimiento: event.target.value }))} />
          </div>
          <label className='flex items-center gap-2 text-sm sm:col-span-2'>
            <Checkbox checked={form.ncf_manual} onCheckedChange={(value) => setForm((current) => ({ ...current, ncf_manual: Boolean(value) }))} />
            NCF manual
          </label>
        </div>
        <div className='flex justify-end gap-2'>
          <Button variant='outline' size='sm' onClick={onClose}>Cancelar</Button>
          <Button size='sm' onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Crear'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
