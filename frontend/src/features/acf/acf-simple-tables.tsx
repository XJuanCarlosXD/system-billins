import { useState, ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'

// ---------------------------------------------------------------------------
// Componente CRUD genérico para catálogos simples de ACF
// ---------------------------------------------------------------------------
interface FieldSpec {
  key: string
  label: string
  type?: 'text' | 'number'
  maxLength?: number
  isPk?: boolean          // no editable en modo "editar"
  required?: boolean
  uppercase?: boolean
  colClass?: string       // css extra en la celda
}

interface Props {
  title: string
  description?: ReactNode
  queryKey: string
  fetchList: () => Promise<any[]>
  createFn: (d: any) => Promise<any>
  updateFn: (row: any, d: any) => Promise<any>
  deleteFn: (row: any) => Promise<any>
  pkLabel: (row: any) => string
  fields: FieldSpec[]
  extraCols?: { key: string; label: string; render?: (v: any, r: any) => ReactNode }[]
  maxWidth?: string
}

function CatalogCrud({
  title, description, queryKey, fetchList, createFn, updateFn, deleteFn,
  pkLabel, fields, extraCols = [], maxWidth = '5xl',
}: Props) {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editRow, setEditRow] = useState<any | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [deleteRow, setDeleteRow] = useState<any | null>(null)

  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: [queryKey], queryFn: fetchList,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: [queryKey] })

  const createMut = useMutation({
    mutationFn: (d: any) => createFn(d),
    onSuccess: () => {
      toast.success('Registro creado')
      setDialogOpen(false); setForm({})
      invalidate()
    },
    onError: (e: any) => toast.error(e?.detail?.error || e?.message || 'Error'),
  })

  const updateMut = useMutation({
    mutationFn: ({ row, d }: any) => updateFn(row, d),
    onSuccess: () => {
      toast.success('Registro actualizado')
      setDialogOpen(false); setEditRow(null); setForm({})
      invalidate()
    },
    onError: (e: any) => toast.error(e?.detail?.error || e?.message || 'Error'),
  })

  const deleteMut = useMutation({
    mutationFn: (row: any) => deleteFn(row),
    onSuccess: () => { toast.success('Registro eliminado'); setDeleteRow(null); invalidate() },
    onError: (e: any) => toast.error(e?.detail?.error || e?.message || 'Error'),
  })

  const openNew = () => { setEditRow(null); setForm({}); setDialogOpen(true) }
  const openEdit = (row: any) => { setEditRow(row); setForm({ ...row }); setDialogOpen(true) }

  const handleSubmit = () => {
    for (const f of fields) {
      if (f.required && (form[f.key] === undefined || form[f.key] === '')) {
        toast.error(`${f.label} es requerido`)
        return
      }
    }
    if (editRow) updateMut.mutate({ row: editRow, d: form })
    else createMut.mutate(form)
  }

  const editableFields = editRow ? fields.filter(f => !f.isPk) : fields

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5"><Plus className="h-4 w-4" /> Nuevo</Button>
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
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r, i) => (
                <TableRow key={i}>
                  {fields.map(f => (
                    <TableCell key={f.key} className={f.colClass ?? 'font-mono text-xs'}>
                      {r[f.key] ?? '—'}
                    </TableCell>
                  ))}
                  {extraCols.map(c => (
                    <TableCell key={c.key}>{c.render ? c.render(r[c.key], r) : (r[c.key] ?? '—')}</TableCell>
                  ))}
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteRow(r)} title="Eliminar">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={fields.length + extraCols.length + 1} className="text-center text-muted-foreground py-6">
                    Sin registros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditRow(null); setForm({}) } }}>
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

// ---------------------------------------------------------------------------
// Cías / Puntos — read-only (config)
// ---------------------------------------------------------------------------
function TableShell({ rows, isLoading, cols, empty, max = '3xl' }: any) {
  if (isLoading) return <Skeleton className="h-32 w-full" />
  return (
    <div className={`rounded border max-w-${max}`}>
      <Table>
        <TableHeader><TableRow>{cols.map((c: any) => <TableHead key={c.key}>{c.label}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {rows.map((r: any, i: number) => (
            <TableRow key={i}>
              {cols.map((c: any) => (
                <TableCell key={c.key} className={c.key === 'descripcion' || c.key === 'descri' ? '' : 'font-mono text-xs'}>
                  {c.render ? c.render(r[c.key], r) : (r[c.key] ?? '—')}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {!isLoading && rows.length === 0 && (
            <TableRow><TableCell colSpan={cols.length} className="text-center text-muted-foreground py-6">{empty}</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export function AcfCias() {
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['acf-cias'], queryFn: api.acfListCias })
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Compañías habilitadas para Activos Fijos</h3>
        <p className="text-sm text-muted-foreground">Cuentas contables de caja, ganancia por venta, pérdida por venta y superávit por revalúo.</p>
      </div>
      <TableShell isLoading={isLoading} rows={data} empty="Sin empresas habilitadas." max="5xl"
        cols={[
          { key: 'no_cia', label: 'No. CIA' },
          { key: 'descripcion', label: 'Descripción' },
          { key: 'activa', label: 'Activa', render: (v: any) => <Badge variant={v === 'S' ? 'default' : 'secondary'}>{v === 'S' ? 'Sí' : 'No'}</Badge> },
          { key: 'registro_cont', label: 'Reg. Cont.' },
          { key: 'cuenta_caja', label: 'Cuenta Caja' },
          { key: 'ganancia_por_venta', label: 'Ganancia x Venta' },
          { key: 'perdida_por_venta', label: 'Pérdida x Venta' },
          { key: 'superavit_por_reva', label: 'Superávit Revalúo' },
        ]} />
    </div>
  )
}

export function AcfPuntos() {
  const { selectedCompany } = useCompany()
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['acf-puntos', selectedCompany], queryFn: () => api.acfListPuntos(selectedCompany) })
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Sucursales / Puntos ACF</h3>
        <p className="text-sm text-muted-foreground">Empresa <b>{selectedCompany}</b>. Configuración de depreciación y período abierto.</p>
      </div>
      <TableShell isLoading={isLoading} rows={data} empty="Sin puntos para esta empresa." max="5xl"
        cols={[
          { key: 'punto', label: 'Punto' },
          { key: 'descripcion', label: 'Descripción' },
          { key: 'activo', label: 'Activo', render: (v: any) => <Badge variant={v === 'S' ? 'default' : 'secondary'}>{v === 'S' ? 'Sí' : 'No'}</Badge> },
          { key: 'metodo_depre', label: 'Método Depre.' },
          { key: 'ano_proceso', label: 'Año' },
          { key: 'mes_proceso', label: 'Mes' },
          { key: 'prox_activo', label: 'Próx. Activo' },
        ]} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// CRUD Catálogos
// ---------------------------------------------------------------------------

export function AcfCategorias() {
  return (
    <CatalogCrud
      title="Categorías de Activos"
      description="Clasificación contable para depreciación."
      queryKey="acf-categorias"
      fetchList={api.acfListCategorias}
      createFn={(d) => api.acfCreateCategoria(d)}
      updateFn={(row, d) => api.acfUpdateCategoria(row.categoria, d)}
      deleteFn={(row) => api.acfDeleteCategoria(row.categoria)}
      pkLabel={(r) => `${r.categoria}`}
      fields={[
        { key: 'categoria', label: 'Código', type: 'number', isPk: true, required: true, maxLength: 6 },
        { key: 'descripcion', label: 'Descripción', maxLength: 40, required: true, uppercase: true, colClass: '' },
        { key: 'porciento', label: '% Deprec.', type: 'number', required: true },
      ]}
    />
  )
}

export function AcfGrupos() {
  return (
    <CatalogCrud
      title="Grupos de Activos"
      description="Nivel intermedio bajo el tipo contable."
      queryKey="acf-grupos"
      fetchList={api.acfListGrupos}
      createFn={(d) => api.acfCreateGrupo(d)}
      updateFn={(row, d) => api.acfUpdateGrupo(row.tipo, row.grupo, d)}
      deleteFn={(row) => api.acfDeleteGrupo(row.tipo, row.grupo)}
      pkLabel={(r) => `${r.tipo}/${r.grupo}`}
      fields={[
        { key: 'tipo', label: 'Tipo', isPk: true, required: true, uppercase: true, maxLength: 3 },
        { key: 'grupo', label: 'Grupo', isPk: true, required: true, uppercase: true, maxLength: 3 },
        { key: 'descripcion', label: 'Descripción', maxLength: 40, required: true, uppercase: true, colClass: '' },
      ]}
    />
  )
}

export function AcfSubgrupos() {
  return (
    <CatalogCrud
      title="Subgrupos de Activos"
      description="Detalle bajo tipo + grupo."
      queryKey="acf-subgrupos"
      fetchList={api.acfListSubgrupos}
      createFn={(d) => api.acfCreateSubgrupo(d)}
      updateFn={(row, d) => api.acfUpdateSubgrupo(row.tipo, row.grupo, row.subgrupo, d)}
      deleteFn={(row) => api.acfDeleteSubgrupo(row.tipo, row.grupo, row.subgrupo)}
      pkLabel={(r) => `${r.tipo}/${r.grupo}/${r.subgrupo}`}
      fields={[
        { key: 'tipo', label: 'Tipo', isPk: true, required: true, uppercase: true, maxLength: 3 },
        { key: 'grupo', label: 'Grupo', isPk: true, required: true, uppercase: true, maxLength: 3 },
        { key: 'subgrupo', label: 'Subgrupo', isPk: true, required: true, uppercase: true, maxLength: 3 },
        { key: 'descripcion', label: 'Descripción', maxLength: 40, required: true, uppercase: true, colClass: '' },
      ]}
    />
  )
}

export function AcfMarcas() {
  return (
    <CatalogCrud
      title="Marcas"
      description="Catálogo abierto de marcas asignables a activos."
      queryKey="acf-marcas"
      fetchList={api.acfListMarcas}
      createFn={(d) => api.acfCreateMarca(d)}
      updateFn={(row, d) => api.acfUpdateMarca(row.marca, d)}
      deleteFn={(row) => api.acfDeleteMarca(row.marca)}
      pkLabel={(r) => `${r.marca}`}
      fields={[
        { key: 'marca', label: 'Código', isPk: true, required: true, uppercase: true, maxLength: 6 },
        { key: 'descripcion', label: 'Descripción', maxLength: 40, required: true, uppercase: true, colClass: '' },
      ]}
    />
  )
}

export function AcfResponsables() {
  return (
    <CatalogCrud
      title="Responsables"
      description="Personas asignadas como custodios de los activos."
      queryKey="acf-responsables"
      fetchList={api.acfListResponsables}
      createFn={(d) => api.acfCreateResponsable(d)}
      updateFn={(row, d) => api.acfUpdateResponsable(row.responsable, d)}
      deleteFn={(row) => api.acfDeleteResponsable(row.responsable)}
      pkLabel={(r) => `${r.responsable}`}
      fields={[
        { key: 'responsable', label: 'Código', isPk: true, required: true, uppercase: true, maxLength: 6 },
        { key: 'nombre', label: 'Nombre', maxLength: 50, required: true, uppercase: true, colClass: '' },
      ]}
    />
  )
}

export function AcfDepartamentos() {
  return (
    <CatalogCrud
      title="Departamentos"
      description="Ubicación organizacional del activo."
      queryKey="acf-departamentos"
      fetchList={api.acfListDepartamentos}
      createFn={(d) => api.acfCreateDepartamento(d)}
      updateFn={(row, d) => api.acfUpdateDepartamento(row.departamento, d)}
      deleteFn={(row) => api.acfDeleteDepartamento(row.departamento)}
      pkLabel={(r) => `${r.departamento}`}
      fields={[
        { key: 'departamento', label: 'Código', isPk: true, required: true, uppercase: true, maxLength: 6 },
        { key: 'descripcion', label: 'Descripción', maxLength: 40, required: true, uppercase: true, colClass: '' },
      ]}
    />
  )
}
