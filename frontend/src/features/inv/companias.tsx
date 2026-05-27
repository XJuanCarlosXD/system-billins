import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Props { noCia: string; punto: string }

interface Compania {
  no_cia: string
  descripcion: string
  activo?: string | null
  registro_cont?: string | null
  [key: string]: any
}

const PAGE_SIZE = 20

export function CompaniasInv(_props: Props) {
  const [rows, setRows] = useState<Compania[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Compania | null>(null)
  const [deleting, setDeleting] = useState<Compania | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    regalGeneralApi
      .invListCompanias()
      .then((data) => setRows(data.results ?? []))
      .catch((err) => setError(err?.detail?.error ?? err?.message ?? 'Error al cargar compañías'))
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
        String(r.no_cia ?? '').toLowerCase().includes(q) ||
        String(r.descripcion ?? '').toLowerCase().includes(q),
    )
  }, [rows, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const isActiva = (val: string | null | undefined) => val === 'S'

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (row: Compania) => { setEditing(row); setFormOpen(true) }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await regalGeneralApi.invDeleteCompania(deleting.no_cia)
      toast.success(`Compañía ${deleting.no_cia} eliminada`)
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
          <h2 className='text-lg font-semibold'>Compañías</h2>
          <p className='text-sm text-muted-foreground'>Mantenimiento de compañías registradas en el sistema (FINV101).</p>
        </div>
        <div className='flex items-center gap-3'>
          <span className='text-sm text-muted-foreground'>{filtered.length} registros</span>
          <Button size='sm' onClick={openCreate}>
            <Plus className='mr-2 h-4 w-4' /> Nueva compañía
          </Button>
        </div>
      </div>

      <div className='relative rounded-xl border p-4'>
        <Search className='absolute left-6 top-6 h-4 w-4 text-muted-foreground' />
        <Input
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value) }}
          placeholder='Filtrar por número o descripción...'
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
            <TableHead className='w-24'>No. Cía</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className='text-center w-24'>Activa</TableHead>
            <TableHead className='w-32 text-right'>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={4} className='py-10 text-center text-muted-foreground'>
                Cargando...
              </TableCell>
            </TableRow>
          )}
          {!loading && paged.map((row) => (
            <TableRow key={row.no_cia}>
              <TableCell>
                <Badge variant='outline' className='font-mono font-semibold'>{row.no_cia}</Badge>
              </TableCell>
              <TableCell>{row.descripcion}</TableCell>
              <TableCell className='text-center'>
                {isActiva(row.activo)
                  ? <Badge variant='outline' className='border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-300'>Activa</Badge>
                  : <Badge variant='outline' className='border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300'>Inactiva</Badge>
                }
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
              <TableCell colSpan={4} className='py-10 text-center text-muted-foreground'>
                No se encontraron compañías.
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
        <CompaniaFormDialog
          compania={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); load() }}
        />
      )}

      {deleting && (
        <Dialog open onOpenChange={() => setDeleting(null)}>
          <DialogContent className='max-w-sm'>
            <DialogHeader>
              <DialogTitle>Eliminar compañía</DialogTitle>
            </DialogHeader>
            <p className='text-sm text-muted-foreground'>
              Se eliminará la compañía <span className='font-mono font-medium'>{deleting.no_cia}</span> ({deleting.descripcion}). Esta acción no se puede deshacer.
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

function CompaniaFormDialog({
  compania,
  onClose,
  onSaved,
}: {
  compania: Compania | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = Boolean(compania)
  const [codigo, setCodigo] = useState(compania?.no_cia ?? '')
  const [descripcion, setDescripcion] = useState(compania?.descripcion ?? '')
  const [activo, setActivo] = useState((compania?.activo ?? 'S') === 'S')
  const [registroCont, setRegistroCont] = useState((compania?.registro_cont ?? 'S') === 'S')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!codigo.trim() || !descripcion.trim()) {
      toast.error('No. Cía y descripción son requeridos')
      return
    }
    setSaving(true)
    try {
      if (isEdit) {
        await regalGeneralApi.invUpdateCompania(codigo.trim(), {
          descripcion: descripcion.trim(),
          activo: activo ? 'S' : 'N',
          registro_cont: registroCont ? 'S' : 'N',
        })
        toast.success(`Compañía ${codigo.trim()} actualizada`)
      } else {
        await regalGeneralApi.invCreateCompania({
          no_cia: codigo.trim(),
          descripcion: descripcion.trim(),
          activo: activo ? 'S' : 'N',
          registro_cont: registroCont ? 'S' : 'N',
        })
        toast.success(`Compañía ${codigo.trim()} creada`)
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
          <DialogTitle>{isEdit ? 'Editar compañía' : 'Nueva compañía'}</DialogTitle>
        </DialogHeader>
        <div className='space-y-3'>
          <div className='space-y-1'>
            <label className='text-xs font-medium'>No. Cía</label>
            <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} disabled={isEdit} />
          </div>
          <div className='space-y-1'>
            <label className='text-xs font-medium'>Descripción</label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <label className='flex items-center gap-2 text-sm'>
            <Checkbox checked={activo} onCheckedChange={(value) => setActivo(Boolean(value))} />
            Activa
          </label>
          <label className='flex items-center gap-2 text-sm'>
            <Checkbox checked={registroCont} onCheckedChange={(value) => setRegistroCont(Boolean(value))} />
            Registro contable
          </label>
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
