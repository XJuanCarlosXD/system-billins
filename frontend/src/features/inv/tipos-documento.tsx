import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Props { noCia: string; punto: string }

interface TipoDocumento {
  tipo_docu: string
  descripcion: string
  tipo_movi?: string | null
  tipo_transaccion?: string | null
  nc_obligatoria?: string | null
  [key: string]: any
}

const TIPO_DOC_COLORS: Record<string, string> = {
  DC: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200',
  DV: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-200',
  EA: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200',
  EP: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900 dark:text-teal-200',
  SP: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-200',
  AS: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200',
  AE: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-200',
  SA: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900 dark:text-rose-200',
  TA: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900 dark:text-indigo-200',
  EC: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900 dark:text-cyan-200',
}

const PAGE_SIZE = 20

export function TiposDocumento(_props: Props) {
  const [rows, setRows] = useState<TipoDocumento[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TipoDocumento | null>(null)
  const [deleting, setDeleting] = useState<TipoDocumento | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    regalGeneralApi
      .invListTiposDocu()
      .then((data) => setRows(data.results ?? []))
      .catch((err) => setError(err?.detail?.error ?? err?.message ?? 'Error al cargar tipos de documento'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        String(r.tipo_docu ?? '').toLowerCase().includes(q) ||
        String(r.descripcion ?? '').toLowerCase().includes(q) ||
        String(r.tipo_transaccion ?? '').toLowerCase().includes(q) ||
        String(r.tipo_movi ?? '').toLowerCase().includes(q),
    )
  }, [rows, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (row: TipoDocumento) => { setEditing(row); setFormOpen(true) }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await regalGeneralApi.invDeleteTipoDocu(deleting.tipo_docu)
      toast.success(`Tipo de documento ${deleting.tipo_docu} eliminado`)
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
          <h2 className='text-lg font-semibold'>Tipos de Documento</h2>
          <p className='text-sm text-muted-foreground'>Mantenimiento de tipos de documento de inventario (FINV112).</p>
        </div>
        <div className='flex items-center gap-3'>
          <span className='text-sm text-muted-foreground'>{filtered.length} registros</span>
          <Button size='sm' onClick={openCreate}>
            <Plus className='mr-2 h-4 w-4' /> Nuevo tipo
          </Button>
        </div>
      </div>

      <div className='relative rounded-xl border p-4'>
        <Search className='absolute left-6 top-6 h-4 w-4 text-muted-foreground' />
        <Input
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value) }}
          placeholder='Filtrar por tipo, descripción o transacción...'
          className='h-9 pl-8'
        />
      </div>

      {error && (
        <div className='rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400'>
          {error}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-24'>Tipo Doc.</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className='w-40'>Tipo Movi.</TableHead>
            <TableHead className='w-40'>Tipo Transacción</TableHead>
            <TableHead className='w-32 text-right'>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={5} className='py-10 text-center text-muted-foreground'>
                Cargando...
              </TableCell>
            </TableRow>
          )}
          {!loading && paged.map((row) => {
            const colorClass = TIPO_DOC_COLORS[row.tipo_docu] ?? 'bg-gray-100 text-gray-800 border-gray-200'
            return (
              <TableRow key={row.tipo_docu}>
                <TableCell>
                  <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-mono font-semibold ${colorClass}`}>
                    {row.tipo_docu}
                  </span>
                </TableCell>
                <TableCell>{row.descripcion}</TableCell>
                <TableCell className='text-sm text-muted-foreground'>{row.tipo_movi ?? '—'}</TableCell>
                <TableCell className='text-sm text-muted-foreground'>{row.tipo_transaccion ?? '—'}</TableCell>
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
            )
          })}
          {!loading && !error && filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className='py-10 text-center text-muted-foreground'>
                No se encontraron tipos de documento.
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
        <TipoDocFormDialog
          tipo={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); load() }}
        />
      )}

      {deleting && (
        <Dialog open onOpenChange={() => setDeleting(null)}>
          <DialogContent className='max-w-sm'>
            <DialogHeader>
              <DialogTitle>Eliminar tipo de documento</DialogTitle>
            </DialogHeader>
            <p className='text-sm text-muted-foreground'>
              Se eliminará el tipo de documento <span className='font-mono font-medium'>{deleting.tipo_docu}</span> ({deleting.descripcion}). Esta acción no se puede deshacer.
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

function TipoDocFormDialog({
  tipo,
  onClose,
  onSaved,
}: {
  tipo: TipoDocumento | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = Boolean(tipo)
  const [codigo, setCodigo] = useState(tipo?.tipo_docu ?? '')
  const [descripcion, setDescripcion] = useState(tipo?.descripcion ?? '')
  const [tipoMovi, setTipoMovi] = useState(tipo?.tipo_movi ?? 'E')
  const [tipoTransaccion, setTipoTransaccion] = useState(tipo?.tipo_transaccion ?? 'E')
  const [ncObligatoria, setNcObligatoria] = useState(tipo?.nc_obligatoria ?? 'N')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!codigo.trim() || !descripcion.trim()) {
      toast.error('Tipo de documento y descripción son requeridos')
      return
    }
    setSaving(true)
    const payload = {
      descripcion: descripcion.trim(),
      tipo_movi: (tipoMovi ?? 'E').trim() || 'E',
      tipo_transaccion: (tipoTransaccion ?? 'E').trim() || 'E',
      nc_obligatoria: (ncObligatoria ?? 'N').trim() || 'N',
    }
    try {
      if (isEdit) {
        await regalGeneralApi.invUpdateTipoDocu(codigo.trim(), payload)
        toast.success(`Tipo de documento ${codigo.trim()} actualizado`)
      } else {
        await regalGeneralApi.invCreateTipoDocu({ tipo_docu: codigo.trim(), ...payload })
        toast.success(`Tipo de documento ${codigo.trim()} creado`)
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
          <DialogTitle>{isEdit ? 'Editar tipo de documento' : 'Nuevo tipo de documento'}</DialogTitle>
        </DialogHeader>
        <div className='space-y-3'>
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1'>
              <label className='text-xs font-medium'>Tipo Doc.</label>
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} disabled={isEdit} maxLength={2} />
            </div>
            <div className='space-y-1'>
              <label className='text-xs font-medium'>Descripción</label>
              <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </div>
            <div className='space-y-1'>
              <label className='text-xs font-medium'>Tipo Movimiento</label>
              <Input value={tipoMovi ?? ''} onChange={(e) => setTipoMovi(e.target.value)} maxLength={1} />
            </div>
            <div className='space-y-1'>
              <label className='text-xs font-medium'>Tipo Transacción</label>
              <Input value={tipoTransaccion ?? ''} onChange={(e) => setTipoTransaccion(e.target.value)} maxLength={1} />
            </div>
            <div className='space-y-1'>
              <label className='text-xs font-medium'>NC Obligatoria</label>
              <Input value={ncObligatoria ?? ''} onChange={(e) => setNcObligatoria(e.target.value)} maxLength={1} />
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
