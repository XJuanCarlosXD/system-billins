// Shared catalog component factory for simple CRUD tables
// Used by: cias, puntos, tdocu, tcli, supervisores, rutas, tcontable, ciudades, barrios, zonas, cadenas
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'

interface CatalogField {
  key: string
  label: string
  type?: 'text' | 'number' | 'select' | 'checkbox'
  options?: { value: string; label: string }[]
  readOnly?: boolean
  width?: string
}

interface CatalogProps {
  title: string
  fields: CatalogField[]
  fetchFn: () => Promise<any[]>
  saveFn: (data: any) => Promise<any>
  deleteFn?: (item: any) => Promise<any>
  idFields: string[]
  noCia: string
}

export function CatalogoCrud({ title, fields, fetchFn, saveFn, deleteFn, idFields }: CatalogProps) {
  const [rows, setRows] = useState<any[]>([])
  const [form, setForm] = useState<any>({})
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [isNew, setIsNew] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await fetchFn()
      setRows(data)
    } catch {}
  }, [fetchFn])

  useEffect(() => { load() }, [load])

  const openNew = () => {
    setForm({})
    setIsNew(true)
    setError('')
    setOpen(true)
  }

  const openEdit = (row: any) => {
    setForm({ ...row })
    setIsNew(false)
    setError('')
    setOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await saveFn(form)
      setOpen(false)
      load()
    } catch (e: any) {
      setError(e?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row: any) => {
    if (!deleteFn) return
    if (!confirm('¿Eliminar este registro?')) return
    try {
      await deleteFn(row)
      load()
    } catch (e: any) {
      alert(e?.message || 'Error al eliminar')
    }
  }

  const displayCols = fields.filter(f => !f.readOnly || idFields.includes(f.key))

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />Nuevo</Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {displayCols.map(f => <TableHead key={f.key} style={{ width: f.width }}>{f.label}</TableHead>)}
              <TableHead className="w-20">Acc.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={displayCols.length + 1} className="text-center text-muted-foreground py-8">Sin registros</TableCell></TableRow>
            )}
            {rows.map((row, i) => (
              <TableRow key={i}>
                {displayCols.map(f => (
                  <TableCell key={f.key}>
                    {f.type === 'checkbox'
                      ? (row[f.key] === 'S' || row[f.key] === true ? 'Sí' : 'No')
                      : String(row[f.key] ?? '')}
                  </TableCell>
                ))}
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                    {deleteFn && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(row)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg">
          <DialogHeader><DialogTitle>{isNew ? 'Nuevo' : 'Editar'} — {title}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            {fields.map(f => (
              <div key={f.key} className="space-y-1">
                <Label>{f.label}</Label>
                {f.type === 'select' ? (
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={form[f.key] ?? ''}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    disabled={!isNew && idFields.includes(f.key)}
                  >
                    <option value="">-- Seleccione --</option>
                    {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === 'checkbox' ? (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      checked={form[f.key] === 'S' || form[f.key] === true}
                      onChange={e => setForm({ ...form, [f.key]: e.target.checked ? 'S' : 'N' })}
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-muted-foreground">Activo</span>
                  </div>
                ) : (
                  <Input
                    type={f.type === 'number' ? 'number' : 'text'}
                    value={form[f.key] ?? ''}
                    onChange={e => setForm({ ...form, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                    disabled={!isNew && idFields.includes(f.key)}
                  />
                )}
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
