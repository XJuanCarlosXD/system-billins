import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Props { noCia: string; punto: string }

interface Linea {
  linea: string
  descripcion: string
  [key: string]: any
}

interface SubLinea {
  linea: string
  sub_linea: string
  descripcion: string
  pct_comision?: number | null
  pct_margen?: number | null
  [key: string]: any
}

const PAGE_SIZE = 20

export function SubLineasProductos({ noCia }: Props) {
  const [lineas, setLineas] = useState<Linea[]>([])
  const [selectedLinea, setSelectedLinea] = useState<string>('')
  const [rows, setRows] = useState<SubLinea[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SubLinea | null>(null)
  const [deleting, setDeleting] = useState<SubLinea | null>(null)

  useEffect(() => {
    if (noCia) {
      regalGeneralApi.invListLineas(noCia).then((d) => setLineas(d.results ?? [])).catch(() => {})
    }
  }, [noCia])

  const load = () => {
    setLoading(true)
    setError(null)
    regalGeneralApi
      .invListSublineas(noCia, selectedLinea)
      .then((data) => setRows(data.results ?? []))
      .catch((err) => setError(err?.detail?.error ?? err?.message ?? 'Error al cargar sublíneas'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (noCia) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noCia, selectedLinea])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        String(r.linea ?? '').toLowerCase().includes(q) ||
        String(r.sub_linea ?? '').toLowerCase().includes(q) ||
        String(r.descripcion ?? '').toLowerCase().includes(q),
    )
  }, [rows, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (row: SubLinea) => { setEditing(row); setFormOpen(true) }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await regalGeneralApi.invDeleteSublinea(deleting.linea, deleting.sub_linea)
      toast.success(`Sub línea ${deleting.sub_linea} eliminada`)
      setDeleting(null)
      load()
    } catch (err: any) {
      toast.error(err?.detail?.error ?? err?.message ?? 'No se pudo eliminar')
    }
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>Sub Líneas de Productos</h2>
          <p className='text-sm text-muted-foreground'>Catálogo de sublíneas para la clasificación detallada de productos.</p>
        </div>
        <div className='flex items-center gap-3'>
          <span className='text-sm text-muted-foreground'>{filtered.length} registros</span>
          <Button size='sm' onClick={openCreate}>
            <Plus className='mr-2 h-4 w-4' /> Nueva sublínea
          </Button>
        </div>
      </div>

      <div className='flex flex-wrap gap-3'>
        <Select
          value={selectedLinea || '__all__'}
          onValueChange={(v) => { setPage(1); setSelectedLinea(v === '__all__' ? '' : v) }}
        >
          <SelectTrigger className='h-9 w-56'>
            <SelectValue placeholder='Todas las líneas' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='__all__'>Todas las líneas</SelectItem>
            {lineas.map((l) => (
              <SelectItem key={l.linea} value={l.linea}>
                {l.linea} — {l.descripcion}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className='relative flex-1'>
          <Search className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
          <Input
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value) }}
            placeholder='Filtrar por código o descripción...'
            className='h-9 pl-8'
          />
        </div>
      </div>

      {error && (
        <div className='rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400'>
          {error}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-28'>Línea</TableHead>
            <TableHead className='w-32'>Sub Línea</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className='text-right w-28'>% Comisión</TableHead>
            <TableHead className='text-right w-28'>% Margen</TableHead>
            <TableHead className='w-32 text-right'>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>
                Cargando...
              </TableCell>
            </TableRow>
          )}
          {!loading && paged.map((row, idx) => (
            <TableRow key={`${row.linea}-${row.sub_linea}-${idx}`}>
              <TableCell>
                <Badge variant='outline' className='font-mono'>{row.linea}</Badge>
              </TableCell>
              <TableCell className='font-mono font-medium'>{row.sub_linea}</TableCell>
              <TableCell>{row.descripcion}</TableCell>
              <TableCell className='text-right font-mono'>
                {row.pct_comision != null ? `${Number(row.pct_comision).toFixed(2)}%` : '—'}
              </TableCell>
              <TableCell className='text-right font-mono'>
                {row.pct_margen != null ? `${Number(row.pct_margen).toFixed(2)}%` : '—'}
              </TableCell>
              <TableCell className='text-right'>
                <div className='flex justify-end gap-1'>
                  <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => openEdit(row)}>
                    <Pencil className='h-4 w-4' />
                  </Button>
                  <Button variant='ghost' size='icon' className='h-8 w-8 text-red-600' onClick={() => setDeleting(row)}>
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {!loading && !error && filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>
                No se encontraron sublíneas de productos.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className='flex items-center justify-between text-sm'>
        <span className='text-muted-foreground'>Página {page} de {totalPages}</span>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
          <Button variant='outline' size='sm' disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
        </div>
      </div>

      {formOpen && (
        <SubLineaFormDialog
          sublinea={editing}
          lineas={lineas}
          defaultLinea={selectedLinea}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); load() }}
        />
      )}

      {deleting && (
        <Dialog open onOpenChange={() => setDeleting(null)}>
          <DialogContent className='max-w-sm'>
            <DialogHeader>
              <DialogTitle>Eliminar sublínea</DialogTitle>
            </DialogHeader>
            <p className='text-sm text-muted-foreground'>
              Se eliminará la sublínea <span className='font-mono font-medium'>{deleting.linea}/{deleting.sub_linea}</span> ({deleting.descripcion}). Esta acción no se puede deshacer.
            </p>
            <div className='flex justify-end gap-2'>
              <Button variant='outline' size='sm' onClick={() => setDeleting(null)}>Cancelar</Button>
              <Button variant='destructive' size='sm' onClick={confirmDelete}>Eliminar</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  )
}

function SubLineaFormDialog({
  sublinea,
  lineas,
  defaultLinea,
  onClose,
  onSaved,
}: {
  sublinea: SubLinea | null
  lineas: Linea[]
  defaultLinea: string
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = Boolean(sublinea)
  const [linea, setLinea] = useState(sublinea?.linea ?? defaultLinea ?? '')
  const [subLinea, setSubLinea] = useState(sublinea?.sub_linea ?? '')
  const [descripcion, setDescripcion] = useState(sublinea?.descripcion ?? '')
  const [pctComision, setPctComision] = useState(sublinea?.pct_comision != null ? String(sublinea.pct_comision) : '')
  const [pctMargen, setPctMargen] = useState(sublinea?.pct_margen != null ? String(sublinea.pct_margen) : '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!linea.trim() || !subLinea.trim()) {
      toast.error('Línea y sub línea son requeridos')
      return
    }
    const comision = pctComision.trim() === '' ? null : Number(pctComision)
    const margen = pctMargen.trim() === '' ? null : Number(pctMargen)
    setSaving(true)
    try {
      if (isEdit) {
        await regalGeneralApi.invUpdateSublinea(linea.trim(), subLinea.trim(), {
          descripcion: descripcion.trim(),
          pct_comision: comision,
          pct_margen: margen,
        })
        toast.success(`Sub línea ${subLinea.trim()} actualizada`)
      } else {
        await regalGeneralApi.invCreateSublinea({
          linea: linea.trim(),
          sub_linea: subLinea.trim(),
          descripcion: descripcion.trim(),
          pct_comision: comision,
          pct_margen: margen,
        })
        toast.success(`Sub línea ${subLinea.trim()} creada`)
      }
      onSaved()
    } catch (err: any) {
      toast.error(err?.detail?.error ?? err?.message ?? 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar sublínea' : 'Nueva sublínea'}</DialogTitle>
        </DialogHeader>
        <div className='space-y-3'>
          <div className='space-y-1'>
            <label className='text-xs font-medium'>Línea</label>
            {isEdit ? (
              <Input value={linea} disabled />
            ) : (
              <Select value={linea} onValueChange={setLinea}>
                <SelectTrigger className='h-9'>
                  <SelectValue placeholder='Seleccione una línea' />
                </SelectTrigger>
                <SelectContent>
                  {lineas.map((l) => (
                    <SelectItem key={l.linea} value={l.linea}>
                      {l.linea} — {l.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className='space-y-1'>
            <label className='text-xs font-medium'>Sub Línea</label>
            <Input value={subLinea} onChange={(e) => setSubLinea(e.target.value)} disabled={isEdit} />
          </div>
          <div className='space-y-1'>
            <label className='text-xs font-medium'>Descripción</label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1'>
              <label className='text-xs font-medium'>% Comisión</label>
              <Input type='number' value={pctComision} onChange={(e) => setPctComision(e.target.value)} />
            </div>
            <div className='space-y-1'>
              <label className='text-xs font-medium'>% Margen</label>
              <Input type='number' value={pctMargen} onChange={(e) => setPctMargen(e.target.value)} />
            </div>
          </div>
          <div className='flex justify-end gap-2'>
            <Button variant='outline' size='sm' onClick={onClose}>Cancelar</Button>
            <Button size='sm' onClick={save} disabled={saving}>
              {saving ? 'Guardando...' : isEdit ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
