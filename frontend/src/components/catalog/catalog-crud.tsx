import { useState, ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'

export interface FieldSpec {
  key: string
  label: string
  type?: 'text' | 'number' | 'select'
  maxLength?: number
  isPk?: boolean
  required?: boolean
  uppercase?: boolean
  options?: { value: string; label: string }[]
  defaultValue?: any
  colClass?: string
  render?: (v: any, r: any) => ReactNode
}

export interface CatalogCrudProps {
  title: string
  description?: ReactNode
  queryKey: any[]
  fetchList: () => Promise<any[]>
  createFn?: (d: any) => Promise<any>
  updateFn?: (row: any, d: any) => Promise<any>
  deleteFn?: (row: any) => Promise<any>
  pkLabel: (row: any) => string
  fields: FieldSpec[]
  extraCols?: { key: string; label: string; render?: (v: any, r: any) => ReactNode }[]
  extraFilters?: ReactNode
  maxWidth?: string
  readOnly?: boolean
  emptyMessage?: string
}

export function CatalogCrud({
  title, description, queryKey, fetchList, createFn, updateFn, deleteFn,
  pkLabel, fields, extraCols = [], extraFilters, maxWidth = '5xl',
  readOnly, emptyMessage = 'Sin registros.',
}: CatalogCrudProps) {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editRow, setEditRow] = useState<any | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [deleteRow, setDeleteRow] = useState<any | null>(null)

  const { data = [], isLoading } = useQuery<any[]>({ queryKey, queryFn: fetchList })
  const invalidate = () => qc.invalidateQueries({ queryKey })

  const createMut = useMutation({
    mutationFn: (d: any) => createFn!(d),
    onSuccess: () => {
      toast.success('Registro creado')
      setDialogOpen(false); setForm({}); invalidate()
    },
    onError: (e: any) => toast.error(e?.detail?.error || e?.message || 'Error'),
  })

  const updateMut = useMutation({
    mutationFn: ({ row, d }: any) => updateFn!(row, d),
    onSuccess: () => {
      toast.success('Registro actualizado')
      setDialogOpen(false); setEditRow(null); setForm({}); invalidate()
    },
    onError: (e: any) => toast.error(e?.detail?.error || e?.message || 'Error'),
  })

  const deleteMut = useMutation({
    mutationFn: (row: any) => deleteFn!(row),
    onSuccess: () => { toast.success('Registro eliminado'); setDeleteRow(null); invalidate() },
    onError: (e: any) => toast.error(e?.detail?.error || e?.message || 'Error'),
  })

  const openNew = () => {
    const defaults: Record<string, any> = {}
    for (const f of fields) if (f.defaultValue !== undefined) defaults[f.key] = f.defaultValue
    setEditRow(null); setForm(defaults); setDialogOpen(true)
  }
  const openEdit = (row: any) => { setEditRow(row); setForm({ ...row }); setDialogOpen(true) }

  const handleSubmit = () => {
    for (const f of fields) {
      if (editRow && f.isPk) continue
      if (f.required && (form[f.key] === undefined || form[f.key] === '')) {
        toast.error(`${f.label} es requerido`); return
      }
    }
    if (editRow) updateMut.mutate({ row: editRow, d: form })
    else createMut.mutate(form)
  }

  const editableFields = editRow ? fields.filter(f => !f.isPk) : fields
  const canEdit = !readOnly && !!updateFn
  const canDelete = !readOnly && !!deleteFn
  const canCreate = !readOnly && !!createFn
  const showActions = canEdit || canDelete

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {extraFilters}
          {canCreate && (
            <Button size="sm" onClick={openNew} className="gap-1.5">
              <Plus className="h-4 w-4" /> Nuevo
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className={`rounded border max-w-${maxWidth}`}>
          <Table>
            <TableHeader>
              <TableRow>
                {fields.map(f => <TableHead key={f.key}>{f.label}</TableHead>)}
                {extraCols.map(c => <TableHead key={c.key}>{c.label}</TableHead>)}
                {showActions && <TableHead className="w-24 text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r, i) => (
                <TableRow key={i}>
                  {fields.map(f => (
                    <TableCell key={f.key} className={f.colClass ?? 'font-mono text-xs'}>
                      {f.render ? f.render(r[f.key], r) : (r[f.key] ?? '—')}
                    </TableCell>
                  ))}
                  {extraCols.map(c => (
                    <TableCell key={c.key}>{c.render ? c.render(r[c.key], r) : (r[c.key] ?? '—')}</TableCell>
                  ))}
                  {showActions && (
                    <TableCell className="text-right">
                      {canEdit && (
                        <Button size="icon" variant="ghost" onClick={() => openEdit(r)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button size="icon" variant="ghost" onClick={() => setDeleteRow(r)} title="Eliminar">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={fields.length + extraCols.length + (showActions ? 1 : 0)}
                    className="text-center text-muted-foreground py-6"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditRow(null); setForm({}) } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editRow ? `Editar ${title.toLowerCase()}` : `Nuevo ${title.toLowerCase()}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {editableFields.map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={`f-${f.key}`} className="text-xs">
                  {f.label}{f.required && <span className="text-red-600"> *</span>}
                </Label>
                {f.type === 'select' && f.options ? (
                  <Select value={form[f.key] ?? ''} onValueChange={(v) => setForm(p => ({ ...p, [f.key]: v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                    <SelectContent>
                      {f.options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`f-${f.key}`}
                    type={f.type ?? 'text'}
                    maxLength={f.maxLength}
                    value={form[f.key] ?? ''}
                    onChange={e => {
                      let v = e.target.value
                      if (f.uppercase) v = v.toUpperCase()
                      setForm(prev => ({ ...prev, [f.key]: v }))
                    }}
                    className="h-9"
                  />
                )}
              </div>
            ))}
            {editRow && (
              <div className="text-xs text-muted-foreground">
                Editando <span className="font-mono">{pkLabel(editRow)}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRow} onOpenChange={(o) => { if (!o) setDeleteRow(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará <span className="font-mono">{deleteRow && pkLabel(deleteRow)}</span> del catálogo.
              No se podrá deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteRow && deleteMut.mutate(deleteRow)}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
