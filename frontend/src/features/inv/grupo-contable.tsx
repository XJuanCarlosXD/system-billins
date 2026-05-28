import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Props { noCia: string; punto: string }

interface GrupoContable {
  grupo_contable: string
  descripcion: string
  inventario?: string | null
  ajuste_inventario?: string | null
  costo_venta_contado?: string | null
  costo_venta_credito?: string | null
  ingreso_venta_contado?: string | null
  ingreso_venta_credito?: string | null
  [key: string]: any
}

const PAGE_SIZE = 20

export function GrupoContable(_props: Props) {
  const [rows, setRows] = useState<GrupoContable[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<GrupoContable | null>(null)
  const [deleting, setDeleting] = useState<GrupoContable | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    regalGeneralApi
      .invListGruposContables()
      .then((data) => setRows(data.results ?? []))
      .catch((err) => setError(err?.detail?.error ?? err?.message ?? 'Error al cargar grupos contables'))
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
        String(r.grupo_contable ?? '').toLowerCase().includes(q) ||
        String(r.descripcion ?? '').toLowerCase().includes(q),
    )
  }, [rows, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (row: GrupoContable) => { setEditing(row); setFormOpen(true) }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await regalGeneralApi.invDeleteGrupoContable(deleting.grupo_contable)
      toast.success(`Grupo contable ${deleting.grupo_contable} eliminado`)
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
          <h2 className='text-lg font-semibold'>Grupo Contable</h2>
          <p className='text-sm text-muted-foreground'>Grupos contables para integración con contabilidad (FINV108).</p>
        </div>
        <div className='flex items-center gap-3'>
          <span className='text-sm text-muted-foreground'>{filtered.length} registros</span>
          <Button size='sm' onClick={openCreate}>
            <Plus className='mr-2 h-4 w-4' /> Nuevo grupo contable
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

      <div className='overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-36'>Grupo Contable</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Inventario</TableHead>
              <TableHead>Ajuste Inv.</TableHead>
              <TableHead>CV Contado</TableHead>
              <TableHead>CV Crédito</TableHead>
              <TableHead>IV Contado</TableHead>
              <TableHead>IV Crédito</TableHead>
              <TableHead className='w-28 text-right'>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={9} className='py-10 text-center text-muted-foreground'>
                  Cargando...
                </TableCell>
              </TableRow>
            )}
            {!loading && paged.map((row) => (
              <TableRow key={row.grupo_contable}>
                <TableCell>
                  <Badge variant='outline' className='font-mono'>{row.grupo_contable}</Badge>
                </TableCell>
                <TableCell>{row.descripcion}</TableCell>
                <TableCell className='font-mono text-xs text-muted-foreground'>{row.inventario}</TableCell>
                <TableCell className='font-mono text-xs text-muted-foreground'>{row.ajuste_inventario}</TableCell>
                <TableCell className='font-mono text-xs text-muted-foreground'>{row.costo_venta_contado}</TableCell>
                <TableCell className='font-mono text-xs text-muted-foreground'>{row.costo_venta_credito}</TableCell>
                <TableCell className='font-mono text-xs text-muted-foreground'>{row.ingreso_venta_contado}</TableCell>
                <TableCell className='font-mono text-xs text-muted-foreground'>{row.ingreso_venta_credito}</TableCell>
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
                <TableCell colSpan={9} className='py-10 text-center text-muted-foreground'>
                  No se encontraron grupos contables.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className='flex items-center justify-between text-sm'>
        <span className='text-muted-foreground'>Página {page} de {totalPages}</span>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
          <Button variant='outline' size='sm' disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
        </div>
      </div>

      {formOpen && (
        <GrupoContableFormDialog
          grupo={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); load() }}
        />
      )}

      {deleting && (
        <Dialog open onOpenChange={() => setDeleting(null)}>
          <DialogContent className='max-w-sm'>
            <DialogHeader>
              <DialogTitle>Eliminar grupo contable</DialogTitle>
            </DialogHeader>
            <p className='text-sm text-muted-foreground'>
              Se eliminará el grupo contable <span className='font-mono font-medium'>{deleting.grupo_contable}</span> ({deleting.descripcion}). Esta acción no se puede deshacer.
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

function GrupoContableFormDialog({
  grupo,
  onClose,
  onSaved,
}: {
  grupo: GrupoContable | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = Boolean(grupo)
  const [codigo, setCodigo] = useState(grupo?.grupo_contable ?? '')
  const [descripcion, setDescripcion] = useState(grupo?.descripcion ?? '')
  const [inventario, setInventario] = useState(grupo?.inventario ?? '')
  const [ajusteInventario, setAjusteInventario] = useState(grupo?.ajuste_inventario ?? '')
  const [cvContado, setCvContado] = useState(grupo?.costo_venta_contado ?? '')
  const [cvCredito, setCvCredito] = useState(grupo?.costo_venta_credito ?? '')
  const [ivContado, setIvContado] = useState(grupo?.ingreso_venta_contado ?? '')
  const [ivCredito, setIvCredito] = useState(grupo?.ingreso_venta_credito ?? '')
  const [saving, setSaving] = useState(false)

  const t = (v: string) => (v.trim() === '' ? null : v.trim())

  const save = async () => {
    if (!codigo.trim()) {
      toast.error('El código de grupo contable es requerido')
      return
    }
    setSaving(true)
    const payload = {
      descripcion: descripcion.trim(),
      inventario: t(inventario),
      ajuste_inventario: t(ajusteInventario),
      costo_venta_contado: t(cvContado),
      costo_venta_credito: t(cvCredito),
      ingreso_venta_contado: t(ivContado),
      ingreso_venta_credito: t(ivCredito),
    }
    try {
      if (isEdit) {
        await regalGeneralApi.invUpdateGrupoContable(codigo.trim(), payload)
        toast.success(`Grupo contable ${codigo.trim()} actualizado`)
      } else {
        await regalGeneralApi.invCreateGrupoContable({ grupo_contable: codigo.trim(), ...payload })
        toast.success(`Grupo contable ${codigo.trim()} creado`)
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
          <DialogTitle>{isEdit ? 'Editar grupo contable' : 'Nuevo grupo contable'}</DialogTitle>
        </DialogHeader>
        <div className='space-y-3'>
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1'>
              <label className='text-xs font-medium'>Código</label>
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} disabled={isEdit} />
            </div>
            <div className='space-y-1'>
              <label className='text-xs font-medium'>Descripción</label>
              <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </div>
          </div>
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1'>
              <label className='text-xs font-medium'>Inventario</label>
              <Input value={inventario ?? ''} onChange={(e) => setInventario(e.target.value)} />
            </div>
            <div className='space-y-1'>
              <label className='text-xs font-medium'>Ajuste Inventario</label>
              <Input value={ajusteInventario ?? ''} onChange={(e) => setAjusteInventario(e.target.value)} />
            </div>
            <div className='space-y-1'>
              <label className='text-xs font-medium'>Costo Venta Contado</label>
              <Input value={cvContado ?? ''} onChange={(e) => setCvContado(e.target.value)} />
            </div>
            <div className='space-y-1'>
              <label className='text-xs font-medium'>Costo Venta Crédito</label>
              <Input value={cvCredito ?? ''} onChange={(e) => setCvCredito(e.target.value)} />
            </div>
            <div className='space-y-1'>
              <label className='text-xs font-medium'>Ingreso Venta Contado</label>
              <Input value={ivContado ?? ''} onChange={(e) => setIvContado(e.target.value)} />
            </div>
            <div className='space-y-1'>
              <label className='text-xs font-medium'>Ingreso Venta Crédito</label>
              <Input value={ivCredito ?? ''} onChange={(e) => setIvCredito(e.target.value)} />
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
