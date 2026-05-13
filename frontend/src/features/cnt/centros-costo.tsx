import { useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, Plus, Printer, Search } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv, printHtml } from './export-utils'

interface Props { noCia: string; punto: string; ano: number; mes: number }

export function CentrosCosto({ noCia, punto }: Props) {
  const [rows, setRows] = useState<any[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const load = () => {
    regalGeneralApi.cntCentrosCosto(noCia).then(setRows).catch(() => {})
  }

  useEffect(() => {
    load()
  }, [noCia])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return rows
    return rows.filter((row) =>
      String(row.centro_costo || '').toLowerCase().includes(query) ||
      String(row.descripcion || '').toLowerCase().includes(query),
    )
  }, [rows, search])

  const pagedRows = useMemo(() => {
    const start = (page - 1) * 15
    return filteredRows.slice(start, start + 15)
  }, [filteredRows, page])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / 15))

  const exportExcel = () => {
    downloadCsv(
      `cnt-centros-costo-${noCia}.csv`,
      ['Centro', 'Descripcion', 'Activo', 'Acepta movimiento'],
      filteredRows.map((row) => [row.centro_costo, row.descripcion, row.activo, row.acepta_movi ?? 'N']),
    )
  }

  const exportPdf = () => {
    const body = `
      <table>
        <thead>
          <tr>
            <th>Centro</th>
            <th>Descripcion</th>
            <th>Activo</th>
            <th>Acepta movimiento</th>
          </tr>
        </thead>
        <tbody>
          ${filteredRows.map((row) => `
            <tr>
              <td>${row.centro_costo ?? ''}</td>
              <td>${row.descripcion ?? ''}</td>
              <td>${row.activo ?? ''}</td>
              <td>${row.acepta_movi ?? 'N'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    printHtml(`Centros de costo ${noCia}`, body)
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>Centros de costo</h2>
          <p className='text-sm text-muted-foreground'>Catalogo global con filtro, paginacion y alta rapida.</p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button variant='outline' size='sm' onClick={exportPdf}>
            <Printer className='mr-2 h-4 w-4' /> PDF
          </Button>
          <Button variant='outline' size='sm' onClick={exportExcel}>
            <FileSpreadsheet className='mr-2 h-4 w-4' /> Excel
          </Button>
          <Button size='sm' onClick={() => setCreateOpen(true)}>
            <Plus className='mr-2 h-4 w-4' /> Nuevo centro
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
          placeholder='Filtrar centros...'
          className='h-9 pl-8'
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Codigo</TableHead>
            <TableHead>Descripcion</TableHead>
            <TableHead className='text-center'>Activo</TableHead>
            <TableHead className='text-center'>Acepta movimiento</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagedRows.map((row) => (
            <TableRow key={row.centro_costo}>
              <TableCell className='font-mono'>{row.centro_costo}</TableCell>
              <TableCell>{row.descripcion}</TableCell>
              <TableCell className='text-center'>
                <Badge variant={row.activo === 'S' ? 'outline' : 'secondary'}>{row.activo === 'S' ? 'Activo' : 'Inactivo'}</Badge>
              </TableCell>
              <TableCell className='text-center'>{row.acepta_movi === 'S' ? 'Si' : 'No'}</TableCell>
            </TableRow>
          ))}
          {pagedRows.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className='py-10 text-center text-muted-foreground'>
                No hay centros para ese filtro.
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

      {createOpen && (
        <CentroCostoCreateDialog
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

function CentroCostoCreateDialog({
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
  const [centroCosto, setCentroCosto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [aceptaMovi, setAceptaMovi] = useState(false)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await regalGeneralApi.cntCreateCentroCosto({
        no_cia: noCia,
        punto,
        centro_costo: centroCosto.trim(),
        descripcion: descripcion.trim(),
        acepta_movi: aceptaMovi ? 'S' : 'N',
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
          <DialogTitle>Nuevo centro de costo</DialogTitle>
        </DialogHeader>
        <div className='space-y-3'>
          <div className='space-y-1'>
            <label className='text-xs font-medium'>Codigo</label>
            <Input value={centroCosto} onChange={(event) => setCentroCosto(event.target.value)} />
          </div>
          <div className='space-y-1'>
            <label className='text-xs font-medium'>Descripcion</label>
            <Input value={descripcion} onChange={(event) => setDescripcion(event.target.value)} />
          </div>
          <label className='flex items-center gap-2 text-sm'>
            <Checkbox checked={aceptaMovi} onCheckedChange={(value) => setAceptaMovi(Boolean(value))} />
            Acepta movimiento
          </label>
          <div className='flex justify-end gap-2'>
            <Button variant='outline' size='sm' onClick={onClose}>Cancelar</Button>
            <Button size='sm' onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Crear'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
