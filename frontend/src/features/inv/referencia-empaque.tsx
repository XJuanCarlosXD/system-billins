import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Props { noCia: string; punto: string }

interface ReferenciaEmpaque {
  cod_referencia: string
  descripcion: string
  [key: string]: any
}

const PAGE_SIZE = 20

export function ReferenciaEmpaque(_props: Props) {
  const [rows, setRows] = useState<ReferenciaEmpaque[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ReferenciaEmpaque | null>(null)
  const [deleting, setDeleting] = useState<ReferenciaEmpaque | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    regalGeneralApi
      .invListReferencias()
      .then((data) => setRows(data.results ?? []))
      .catch((err) => setError(err?.detail?.error ?? err?.message ?? 'Error al cargar referencias de empaque'))
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
        String(r.cod_referencia ?? '').toLowerCase().includes(q) ||
        String(r.descripcion ?? '').toLowerCase().includes(q),
    )
  }, [rows, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (row: ReferenciaEmpaque) => { setEditing(row); setFormOpen(true) }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await regalGeneralApi.invDeleteReferencia(deleting.cod_referencia)
      toast.success(`Referencia ${deleting.cod_referencia} eliminada`)
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
          <h2 className='text-lg font-semibold'>Referencia de Empaque</h2>
          <p className='text-sm text-muted-foreground'>Referencias de empaque por producto (FINV110). Ej: 1/20, 1/180, 1/16.</p>
        </div>
        <div className='flex items-center gap-3'>
          <span className='text-sm text-muted-foreground'>{filtered.length} registros</span>
          <Button size='sm' onClick={openCreate}>
            <Plus className='mr-2 h-4 w-4' /> Nueva referencia
          </Button>
        </div>
      </div>

      <div className='relative rounded-xl border p-4'>
        <Search className='absolute left-6 top-6 h-4 w-4 text-muted-foreground' />
        <Input
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value) }}
          placeholder='Filtrar por código o descripción...'
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
            <TableHead className='w-40'>Cod. Referencia</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className='w-32 text-right'>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={3} className='py-10 text-center text-muted-foreground'>
                Cargando...
              </TableCell>
            </TableRow>
          )}
          {!loading && paged.map((row) => (
            <TableRow key={row.cod_referencia}>
              <TableCell className='font-mono font-medium'>{row.cod_referencia}</TableCell>
              <TableCell>{row.descripcion}</TableCell>
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
              <TableCell colSpan={3} className='py-10 text-center text-muted-foreground'>
                No se encontraron referencias de empaque.
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
        <ReferenciaFormDialog
          referencia={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); load() }}
        />
      )}

      {deleting && (
        <Dialog open onOpenChange={() => setDeleting(null)}>
          <DialogContent className='max-w-sm'>
            <DialogHeader>
              <DialogTitle>Eliminar referencia</DialogTitle>
            </DialogHeader>
            <p className='text-sm text-muted-foreground'>
              Se eliminará la referencia <span className='font-mono font-medium'>{deleting.cod_referencia}</span> ({deleting.descripcion}). Esta acción no se puede deshacer.
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

function ReferenciaFormDialog({
  referencia,
  onClose,
  onSaved,
}: {
  referencia: ReferenciaEmpaque | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = Boolean(referencia)
  const [codigo, setCodigo] = useState(referencia?.cod_referencia ?? '')
  const [descripcion, setDescripcion] = useState(referencia?.descripcion ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!codigo.trim()) {
      toast.error('El código de referencia es requerido')
      return
    }
    setSaving(true)
    try {
      if (isEdit) {
        await regalGeneralApi.invUpdateReferencia(codigo.trim(), { descripcion: descripcion.trim() })
        toast.success(`Referencia ${codigo.trim()} actualizada`)
      } else {
        await regalGeneralApi.invCreateReferencia({ referencia: codigo.trim(), descripcion: descripcion.trim() })
        toast.success(`Referencia ${codigo.trim()} creada`)
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
      <DialogContent className='max-w-[70vw] max-h-[70vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar referencia' : 'Nueva referencia'}</DialogTitle>
        </DialogHeader>
        <div className='space-y-3'>
          <div className='space-y-1'>
            <label className='text-xs font-medium'>Código</label>
            <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} disabled={isEdit} />
          </div>
          <div className='space-y-1'>
            <label className='text-xs font-medium'>Descripción</label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
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
