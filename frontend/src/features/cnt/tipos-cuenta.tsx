import { useEffect, useState } from 'react'
import { Pencil, Plus, Printer, Trash2 } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { useCompany } from '@/context/company-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { buildReportMeta, printTiposCuenta } from './export-utils'

const CLASE_LABEL: Record<string, string> = {
  A: 'Activo', P: 'Pasivo', C: 'Capital', I: 'Ingreso', E: 'Egreso',
}

const CLASE_COLOR: Record<string, string> = {
  A: 'bg-blue-100 text-blue-800 border-blue-200',
  P: 'bg-red-100 text-red-800 border-red-200',
  C: 'bg-purple-100 text-purple-800 border-purple-200',
  I: 'bg-green-100 text-green-800 border-green-200',
  E: 'bg-orange-100 text-orange-800 border-orange-200',
}

interface TipoCuenta { tipo: string; descripcion: string; clase: string }

interface FormState { tipo: string; descripcion: string; clase: string }

const EMPTY_FORM: FormState = { tipo: '', descripcion: '', clase: '' }

export function TiposCuenta() {
  const { selectedCompany, selectedPoint } = useCompany()
  const [rows, setRows] = useState<TipoCuenta[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Dialog state
  const [open, setOpen] = useState(false)
  const [editTipo, setEditTipo] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formErr, setFormErr] = useState<string | null>(null)

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState<TipoCuenta | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    regalGeneralApi
      .cntTcuenta()
      .then((data) => setRows(data as TipoCuenta[]))
      .catch(() => setError('Error cargando tipos de cuenta'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // ── Open dialog ──────────────────────────────────────────────────────────────
  const openNew = () => {
    setEditTipo(null)
    setForm(EMPTY_FORM)
    setFormErr(null)
    setOpen(true)
  }

  const openEdit = (row: TipoCuenta) => {
    setEditTipo(row.tipo)
    setForm({ tipo: row.tipo, descripcion: row.descripcion, clase: row.clase })
    setFormErr(null)
    setOpen(true)
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const tipo = form.tipo.trim().toUpperCase()
    const descripcion = form.descripcion.trim()
    const clase = form.clase.trim().toUpperCase()

    if (!tipo || !descripcion || !clase) {
      setFormErr('Todos los campos son requeridos')
      return
    }
    if (!/^[A-Z0-9]{1,10}$/.test(tipo)) {
      setFormErr('Tipo: solo letras y números, máximo 10 caracteres')
      return
    }
    setSaving(true)
    setFormErr(null)
    try {
      if (editTipo) {
        await regalGeneralApi.cntTcuentaUpdate(editTipo, { descripcion, clase })
      } else {
        await regalGeneralApi.cntTcuentaCreate({ tipo, descripcion, clase })
      }
      setOpen(false)
      load()
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.message ?? 'Error guardando'
      setFormErr(msg)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (tipo: string) => {
    setDeleting(tipo)
    try {
      await regalGeneralApi.cntTcuentaDelete(tipo)
      setConfirmDelete(null)
      load()
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.message ?? 'Error eliminando'
      setError(msg)
    } finally {
      setDeleting(null)
    }
  }

  // ── Print ────────────────────────────────────────────────────────────────────
  const handlePrint = async () => {
    const now = new Date()
    const mes = String(now.getMonth() + 1).padStart(2, '0')
    const meta = await buildReportMeta(
      selectedCompany,
      `Punto ${selectedPoint}`,
      `${mes}-${now.getFullYear()}`,
    )
    printTiposCuenta(meta, rows)
  }

  if (loading) {
    return <div className='py-10 text-center text-sm text-muted-foreground'>Cargando...</div>
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>Tipos de Cuenta</h2>
          <p className='text-sm text-muted-foreground'>FCNT104 — Contabilidad General</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={handlePrint}>
            <Printer className='mr-2 h-4 w-4' />
            Imprimir
          </Button>
          <Button size='sm' onClick={openNew}>
            <Plus className='mr-2 h-4 w-4' />
            Nuevo Tipo
          </Button>
        </div>
      </div>

      {error && (
        <div className='rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700'>
          {error}
        </div>
      )}

      <div className='rounded-xl border overflow-hidden'>
        <table className='w-full text-sm'>
          <thead className='bg-muted/50'>
            <tr>
              <th className='px-4 py-2 text-left font-medium text-muted-foreground w-24'>Tipo</th>
              <th className='px-4 py-2 text-left font-medium text-muted-foreground'>Descripción</th>
              <th className='px-4 py-2 text-left font-medium text-muted-foreground w-28'>Clase</th>
              <th className='px-4 py-2 text-right font-medium text-muted-foreground w-24'>Acciones</th>
            </tr>
          </thead>
          <tbody className='divide-y'>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className='px-4 py-8 text-center text-sm text-muted-foreground'>
                  No hay tipos de cuenta registrados
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.tipo} className='hover:bg-muted/30'>
                <td className='px-4 py-2 font-mono font-medium'>{r.tipo}</td>
                <td className='px-4 py-2'>{r.descripcion?.trim()}</td>
                <td className='px-4 py-2'>
                  <Badge
                    variant='outline'
                    className={`text-xs ${CLASE_COLOR[r.clase] ?? ''}`}
                  >
                    {CLASE_LABEL[r.clase] ?? r.clase}
                  </Badge>
                </td>
                <td className='px-4 py-2'>
                  <div className='flex justify-end gap-1'>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-7 w-7'
                      onClick={() => openEdit(r)}
                      title='Editar'
                    >
                      <Pencil className='h-3.5 w-3.5' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-7 w-7 text-destructive hover:text-destructive'
                      onClick={() => setConfirmDelete(r)}
                      title='Eliminar'
                    >
                      <Trash2 className='h-3.5 w-3.5' />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size='lg'>
          <DialogHeader>
            <DialogTitle>{editTipo ? `Editar Tipo: ${editTipo}` : 'Nuevo Tipo de Cuenta'}</DialogTitle>
          </DialogHeader>

          <div className='space-y-4 py-2'>
            <div className='space-y-1.5'>
              <Label htmlFor='tc-tipo'>Tipo</Label>
              <Input
                id='tc-tipo'
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value.toUpperCase() }))}
                placeholder='Ej: ACT, PAS, ING...'
                maxLength={10}
                disabled={!!editTipo}
                className='font-mono'
              />
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='tc-desc'>Descripción</Label>
              <Input
                id='tc-desc'
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                placeholder='Descripción del tipo de cuenta'
                maxLength={60}
              />
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='tc-clase'>Clase</Label>
              <Select
                value={form.clase}
                onValueChange={(v) => setForm((f) => ({ ...f, clase: v }))}
              >
                <SelectTrigger id='tc-clase'>
                  <SelectValue placeholder='Seleccionar clase...' />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CLASE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {k} — {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formErr && (
              <p className='text-sm text-destructive'>{formErr}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : editTipo ? 'Guardar cambios' : 'Crear tipo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Delete Dialog ── */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>Eliminar Tipo de Cuenta</DialogTitle>
          </DialogHeader>
          <p className='text-sm text-muted-foreground py-2'>
            ¿Eliminar el tipo <strong className='font-mono'>{confirmDelete?.tipo}</strong>{' '}
            — {confirmDelete?.descripcion}? Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setConfirmDelete(null)} disabled={!!deleting}>
              Cancelar
            </Button>
            <Button
              variant='destructive'
              disabled={!!deleting}
              onClick={() => confirmDelete && handleDelete(confirmDelete.tipo)}
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}