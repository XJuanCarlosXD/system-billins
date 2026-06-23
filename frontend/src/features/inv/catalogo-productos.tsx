import { useEffect, useState } from 'react'
import { Search, X, ChevronLeft, ChevronRight, History, Plus, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useCompany } from '@/context/company-context'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  MovimientosProductoModal,
  type MovimientosProductoModalAlmacen,
} from '@/features/fat/components/movimientos-producto-modal'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface Producto {
  no_produ: string
  descripcion: string
  linea?: string
  desc_linea?: string
  grupo?: string
  desc_grupo?: string
  costo?: number
  precio?: number
  itbis?: number
  unidad?: string
  empaque?: string
  activo?: string
  [key: string]: any
}

interface PaginatedResponse {
  items?: Producto[]
  results?: Producto[]
  count?: number
  total?: number
  next?: string | null
  previous?: string | null
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function CatalogoProductos() {
  const { selectedCompany, selectedPoint } = useCompany()

  const [search, setSearch] = useState('')
  const [grupo, setGrupo] = useState('__all__')
  const [linea, setLinea] = useState('__all__')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const [productos, setProductos] = useState<Producto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [grupos, setGrupos] = useState<any[]>([])
  const [lineas, setLineas] = useState<any[]>([])
  const [almacenes, setAlmacenes] = useState<MovimientosProductoModalAlmacen[]>([])

  const [selected, setSelected] = useState<Producto | null>(null)
  const [moviProdu, setMoviProdu] = useState<{ no_produ: string; descripcion: string } | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingProdu, setEditingProdu] = useState<string | null>(null) // null = creando, no_produ = editando
  const [sublineas, setSublineas] = useState<any[]>([])
  const [gruposContables, setGruposContables] = useState<any[]>([])

  // Form state
  const emptyForm = {
    no_produ: '', descripcion: '', linea: '', sub_linea: '',
    grupo_produ: '', grupo_contable: '', servicio: 'I',
    tiene_impuesto: true, porciento_impuesto: '18',
    costo: '', activo: 'S' as 'S' | 'N',
  }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  // Load catalogues once
  useEffect(() => {
    if (!selectedCompany) return
    apiFetch<any>(`/inv/grupos/?no_cia=${selectedCompany}`)
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items ?? data.results ?? []
        setGrupos(items)
      })
      .catch(() => setGrupos([]))

    apiFetch<any>(`/inv/lineas/?no_cia=${selectedCompany}`)
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items ?? data.results ?? []
        setLineas(items)
      })
      .catch(() => setLineas([]))

    regalGeneralApi.invAlmacenes(selectedCompany, selectedPoint || undefined)
      .then((data: any) => {
        const items = (data?.results ?? []).map((a: any) => ({
          almacen: String(a.almacen ?? '').trim(),
          descripcion: (a.descripcion ?? '').trim(),
        })).filter((a: MovimientosProductoModalAlmacen) => a.almacen)
        setAlmacenes(items)
      })
      .catch(() => setAlmacenes([]))

    apiFetch<any>(`/inv/sublineas/?no_cia=${selectedCompany}`)
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items ?? data.results ?? []
        setSublineas(items)
      })
      .catch(() => setSublineas([]))

    apiFetch<any>(`/inv/grupo-contable/?no_cia=${selectedCompany}`)
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items ?? data.results ?? []
        setGruposContables(items)
      })
      .catch(() => setGruposContables([]))
  }, [selectedCompany, selectedPoint])

  // Load products
  useEffect(() => {
    if (!selectedCompany) return
    setLoading(true)
    setError('')
    const offset = (page - 1) * pageSize
    const qs = new URLSearchParams({
      no_cia: selectedCompany,
      limit: String(pageSize),
      offset: String(offset),
    })
    if (search) qs.set('search', search)
    if (grupo && grupo !== '__all__') qs.set('grupo', grupo)
    if (linea && linea !== '__all__') qs.set('linea', linea)

    apiFetch<PaginatedResponse>(`/inv/productos/?${qs.toString()}`)
      .then((data) => {
        const items = data.items ?? data.results ?? (Array.isArray(data) ? (data as any) : [])
        const count = data.count ?? data.total ?? (Array.isArray(data) ? (data as any).length : 0)
        setProductos(items)
        setTotal(count)
      })
      .catch((err) => setError(err.message ?? 'Error al cargar productos'))
      .finally(() => setLoading(false))
  }, [selectedCompany, search, grupo, linea, page, pageSize])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const fmt = (n?: number) =>
    n == null ? '—' : n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const reset = () => {
    setSearch('')
    setGrupo('__all__')
    setLinea('__all__')
    setPage(1)
  }

  const openCreate = () => {
    setForm(emptyForm)
    setEditingProdu(null)
    setFormOpen(true)
  }

  const openEdit = async (p: Producto) => {
    setEditingProdu(p.no_produ)
    setSelected(null)
    setFormOpen(true)
    // Fetch detalle completo (la lista paginada no trae grupo_contable, costo_mercado_rd, etc.)
    try {
      const detail = await apiFetch<any>(`/inv/productos/${encodeURIComponent(p.no_produ)}/?no_cia=${selectedCompany}`)
      const d = detail?.data ?? detail ?? {}
      setForm({
        no_produ: d.no_produ ?? p.no_produ ?? '',
        descripcion: d.descripcion ?? p.descripcion ?? '',
        linea: d.linea ?? p.linea ?? '',
        sub_linea: d.sub_linea ?? p.sub_linea ?? '',
        grupo_produ: d.grupo_produ ?? p.grupo_produ ?? p.grupo ?? '',
        grupo_contable: d.grupo_contable ?? '',
        servicio: d.servicio ?? p.servicio ?? 'I',
        tiene_impuesto: (d.tiene_impuesto ?? p.tiene_impuesto ?? 'S') === 'S',
        porciento_impuesto: String(d.porciento_impuesto ?? p.porciento_impuesto ?? p.itbis ?? '18'),
        costo: String(d.costo_mercado_rd ?? d.costo_mercado ?? p.costo_mercado_rd ?? p.costo ?? ''),
        activo: ((d.activo ?? p.activo ?? 'S') === 'N' ? 'N' : 'S') as 'S' | 'N',
      })
    } catch (err: any) {
      toast.error(`No se pudo cargar el producto: ${err.message}`)
    }
  }

  const handleSave = async () => {
    if (!editingProdu && !form.no_produ.trim()) return toast.error('Código del producto requerido')
    if (!form.descripcion.trim()) return toast.error('Descripción requerida')
    if (!form.linea || !form.sub_linea) return toast.error('Línea y sub-línea requeridas')
    if (!form.grupo_produ) return toast.error('Grupo requerido')
    if (!form.grupo_contable) return toast.error('Grupo contable requerido')

    setSaving(true)
    try {
      const csrf = (document.cookie.split('; ').find(c => c.startsWith('csrftoken=')) || '').split('=')[1] || ''
      const body: any = {
        descripcion: form.descripcion.trim(),
        linea: form.linea,
        sub_linea: form.sub_linea,
        grupo_produ: form.grupo_produ,
        grupo_contable: form.grupo_contable,
        servicio: form.servicio,
        tiene_impuesto: form.tiene_impuesto ? 'S' : 'N',
        porciento_impuesto: parseFloat(form.porciento_impuesto) || 0,
        costo: parseFloat(form.costo) || 0,
        activo: form.activo,
      }

      const isEdit = !!editingProdu
      const url = isEdit
        ? `${API_BASE}/inv/productos/${encodeURIComponent(editingProdu!)}/`
        : `${API_BASE}/inv/productos/`
      if (!isEdit) body.no_produ = form.no_produ.trim().toUpperCase()

      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      toast.success(isEdit
        ? `Producto ${editingProdu} actualizado`
        : `Producto ${form.no_produ} creado`)
      setFormOpen(false)
      setEditingProdu(null)
      setForm(emptyForm)
      // Forzar refresh de la lista (re-trigger del useEffect)
      setSearch((s) => s)
      if (!isEdit) setPage(1)
    } catch (err: any) {
      toast.error(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const sublineasFiltradas = form.linea
    ? sublineas.filter((s: any) => String(s.linea) === String(form.linea))
    : sublineas

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-lg font-semibold'>Catálogo de Productos</h2>
          <p className='text-sm text-muted-foreground'>
            {total > 0 ? `${total.toLocaleString()} productos` : 'Empresa: ' + selectedCompany}
          </p>
        </div>
        <Button size='sm' className='gap-1' onClick={openCreate}>
          <Plus className='h-4 w-4' /> Nuevo Producto
        </Button>
      </div>

      {/* Filters */}
      <div className='flex flex-wrap gap-2'>
        <div className='relative flex-1 min-w-[200px]'>
          <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder='Buscar código o descripción...'
            className='pl-8 h-9'
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>

        <Select value={linea} onValueChange={(v) => { setLinea(v); setPage(1) }}>
          <SelectTrigger className='h-9 w-[180px]'>
            <SelectValue placeholder='Línea' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='__all__'>Todas las líneas</SelectItem>
            {lineas.map((l: any) => (
              <SelectItem key={l.linea ?? l.codigo ?? l.id} value={String(l.linea ?? l.codigo ?? l.id)}>
                {l.descripcion ?? l.linea}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={grupo} onValueChange={(v) => { setGrupo(v); setPage(1) }}>
          <SelectTrigger className='h-9 w-[180px]'>
            <SelectValue placeholder='Grupo' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='__all__'>Todos los grupos</SelectItem>
            {grupos.map((g: any) => {
              const code = String(g.grupo_produ ?? g.grupo ?? g.codigo ?? g.id ?? '')
              return (
                <SelectItem key={code} value={code}>
                  {code} — {g.descripcion ?? ''}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        {(search || grupo !== '__all__' || linea !== '__all__') && (
          <Button variant='ghost' size='sm' className='h-9 gap-1' onClick={reset}>
            <X className='h-3.5 w-3.5' /> Limpiar
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className='rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive'>
          {error}
        </div>
      )}

      {/* Table */}
      <div className='rounded-md border overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='min-w-[100px]'>Código</TableHead>
              <TableHead className='min-w-[200px]'>Descripción</TableHead>
              <TableHead>Línea</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead className='text-right'>Costo</TableHead>
              <TableHead className='text-right'>Precio</TableHead>
              <TableHead className='text-center'>ITBIS%</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Empaque</TableHead>
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
            {!loading && productos.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className='py-10 text-center text-muted-foreground'>
                  No se encontraron productos
                </TableCell>
              </TableRow>
            )}
            {!loading && productos.map((p) => (
              <TableRow
                key={p.no_produ}
                className='cursor-pointer hover:bg-muted/50'
                onClick={() => setSelected(p)}
              >
                <TableCell className='font-mono text-xs font-medium'>{p.no_produ}</TableCell>
                <TableCell className='max-w-[240px] truncate text-sm'>{p.descripcion}</TableCell>
                <TableCell className='text-xs text-muted-foreground'>{p.desc_linea ?? p.linea ?? '—'}</TableCell>
                <TableCell className='text-xs text-muted-foreground'>{p.desc_grupo ?? p.grupo ?? '—'}</TableCell>
                <TableCell className='text-right font-mono text-xs'>{fmt(p.costo)}</TableCell>
                <TableCell className='text-right font-mono text-xs'>{fmt(p.precio)}</TableCell>
                <TableCell className='text-center text-xs'>{p.itbis ?? '—'}</TableCell>
                <TableCell className='text-xs'>{p.unidad ?? '—'}</TableCell>
                <TableCell className='text-xs'>{p.empaque ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className='flex items-center justify-between text-sm'>
        <div className='flex items-center gap-2 text-muted-foreground'>
          <span>Filas por página:</span>
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
            <SelectTrigger className='h-7 w-[70px] text-xs'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>Página {page} de {totalPages} — {total.toLocaleString()} total</span>
        </div>
        <div className='flex gap-1'>
          <Button variant='outline' size='icon' className='h-7 w-7' disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className='h-4 w-4' />
          </Button>
          <Button variant='outline' size='icon' className='h-7 w-7' disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className='h-4 w-4' />
          </Button>
        </div>
      </div>

      {/* Detail dialog */}
      {selected && (
        <Dialog open onOpenChange={() => setSelected(null)}>
          <DialogContent className='max-w-[70vw] max-h-[70vh] overflow-y-auto'>
            <DialogHeader>
              <div className='flex items-center justify-between gap-2 pr-6'>
                <DialogTitle className='flex items-center gap-2'>
                  <span className='font-mono text-base'>{selected.no_produ}</span>
                  {selected.activo === 'N' && <Badge variant='secondary'>Inactivo</Badge>}
                </DialogTitle>
                <div className='flex items-center gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    className='gap-1.5'
                    onClick={() => openEdit(selected)}
                  >
                    <Pencil className='h-3.5 w-3.5' /> Editar
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    className='gap-1.5'
                    onClick={() => setMoviProdu({
                      no_produ: selected.no_produ,
                      descripcion: selected.descripcion || '',
                    })}
                  >
                    <History className='h-3.5 w-3.5' /> Ver movimientos
                  </Button>
                </div>
              </div>
            </DialogHeader>
            <div className='space-y-3 text-sm'>
              <p className='font-medium'>{selected.descripcion}</p>
              <div className='grid grid-cols-2 gap-x-4 gap-y-2 text-sm'>
                <DetailRow label='Línea' value={selected.desc_linea ?? selected.linea} />
                <DetailRow label='Grupo' value={selected.desc_grupo ?? selected.grupo} />
                <DetailRow label='Costo' value={fmt(selected.costo)} mono />
                <DetailRow label='Precio' value={fmt(selected.precio)} mono />
                <DetailRow label='ITBIS %' value={selected.itbis != null ? String(selected.itbis) : undefined} />
                <DetailRow label='Unidad' value={selected.unidad} />
                <DetailRow label='Empaque' value={selected.empaque} />
              </div>
              {/* Remaining raw fields */}
              <div className='rounded-md bg-muted/40 p-3'>
                <p className='text-xs font-semibold text-muted-foreground mb-2'>Datos adicionales</p>
                <div className='grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground'>
                  {Object.entries(selected)
                    .filter(([k]) => !['no_produ','descripcion','linea','desc_linea','grupo','desc_grupo','costo','precio','itbis','unidad','empaque','activo'].includes(k))
                    .map(([k, v]) => (
                      <div key={k} className='flex gap-1'>
                        <span className='font-medium'>{k}:</span>
                        <span className='truncate'>{v == null ? '—' : String(v)}</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Movimientos del producto (Rinv304) */}
      {moviProdu && selectedCompany && (
        <MovimientosProductoModal
          open={!!moviProdu}
          onClose={() => setMoviProdu(null)}
          noCia={selectedCompany}
          noProdu={moviProdu.no_produ}
          descripcion={moviProdu.descripcion}
          almacenes={almacenes}
          defaultPunto={selectedPoint || ''}
        />
      )}

      {/* Crear / Editar producto */}
      <Dialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setEditingProdu(null) }}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>{editingProdu ? `Editar Producto ${editingProdu}` : 'Nuevo Producto'}</DialogTitle>
          </DialogHeader>
          <div className='grid grid-cols-2 gap-4 py-2'>
            <div className='space-y-1'>
              <Label htmlFor='np-codigo'>Código <span className='text-destructive'>*</span></Label>
              <Input
                id='np-codigo'
                className='h-9 font-mono uppercase'
                placeholder='00012345'
                value={form.no_produ}
                disabled={!!editingProdu}
                onChange={(e) => setForm((f) => ({ ...f, no_produ: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className='space-y-1'>
              <Label htmlFor='np-activo'>Estado</Label>
              <Select value={form.activo} onValueChange={(v) => setForm((f) => ({ ...f, activo: v as 'S' | 'N' }))}>
                <SelectTrigger id='np-activo' className='h-9'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='S'>Activo</SelectItem>
                  <SelectItem value='N'>Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='col-span-2 space-y-1'>
              <Label htmlFor='np-desc'>Descripción <span className='text-destructive'>*</span></Label>
              <Input
                id='np-desc'
                className='h-9'
                placeholder='Nombre del producto'
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              />
            </div>

            <div className='space-y-1'>
              <Label htmlFor='np-grupo'>Grupo <span className='text-destructive'>*</span></Label>
              <Select value={form.grupo_produ} onValueChange={(v) => setForm((f) => ({ ...f, grupo_produ: v }))}>
                <SelectTrigger id='np-grupo' className='h-9'>
                  <SelectValue placeholder='Seleccionar...' />
                </SelectTrigger>
                <SelectContent>
                  {grupos.map((g: any) => {
                    const code = String(g.grupo_produ ?? g.grupo ?? g.codigo ?? '')
                    return (
                      <SelectItem key={code} value={code}>
                        {code} — {g.descripcion ?? ''}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1'>
              <Label htmlFor='np-linea'>Línea <span className='text-destructive'>*</span></Label>
              <Select value={form.linea} onValueChange={(v) => setForm((f) => ({ ...f, linea: v, sub_linea: '' }))}>
                <SelectTrigger id='np-linea' className='h-9'>
                  <SelectValue placeholder='Seleccionar...' />
                </SelectTrigger>
                <SelectContent>
                  {lineas.map((l: any) => (
                    <SelectItem key={String(l.linea ?? l.codigo)} value={String(l.linea ?? l.codigo)}>
                      {l.linea ?? l.codigo} — {l.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1'>
              <Label htmlFor='np-subl'>Sub-Línea <span className='text-destructive'>*</span></Label>
              <Select value={form.sub_linea} onValueChange={(v) => setForm((f) => ({ ...f, sub_linea: v }))} disabled={!form.linea}>
                <SelectTrigger id='np-subl' className='h-9'>
                  <SelectValue placeholder={form.linea ? 'Seleccionar...' : 'Elija línea primero'} />
                </SelectTrigger>
                <SelectContent>
                  {sublineasFiltradas.map((s: any) => (
                    <SelectItem key={String(s.sub_linea ?? s.codigo)} value={String(s.sub_linea ?? s.codigo)}>
                      {s.sub_linea ?? s.codigo} — {s.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1'>
              <Label htmlFor='np-gc'>Grupo Contable <span className='text-destructive'>*</span></Label>
              <Select value={form.grupo_contable} onValueChange={(v) => setForm((f) => ({ ...f, grupo_contable: v }))}>
                <SelectTrigger id='np-gc' className='h-9'>
                  <SelectValue placeholder='Seleccionar...' />
                </SelectTrigger>
                <SelectContent>
                  {gruposContables.map((g: any) => (
                    <SelectItem key={String(g.grupo_contable ?? g.codigo)} value={String(g.grupo_contable ?? g.codigo)}>
                      {g.grupo_contable ?? g.codigo} — {g.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1'>
              <Label htmlFor='np-tipo'>Tipo</Label>
              <Select value={form.servicio} onValueChange={(v) => setForm((f) => ({ ...f, servicio: v }))}>
                <SelectTrigger id='np-tipo' className='h-9'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='I'>Inventario</SelectItem>
                  <SelectItem value='S'>Servicio</SelectItem>
                  <SelectItem value='K'>Kit</SelectItem>
                  <SelectItem value='C'>Compuesto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1'>
              <Label htmlFor='np-costo'>Costo (RD$)</Label>
              <Input
                id='np-costo'
                className='h-9 text-right tabular-nums'
                type='number'
                min={0}
                step='0.01'
                placeholder='0.00'
                value={form.costo}
                onChange={(e) => setForm((f) => ({ ...f, costo: e.target.value }))}
              />
            </div>

            <div className='space-y-1 col-span-2'>
              <div className='flex items-center gap-3 h-9'>
                <Switch
                  checked={form.tiene_impuesto}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, tiene_impuesto: !!v }))}
                />
                <Label className='cursor-pointer'>Aplica ITBIS</Label>
                {form.tiene_impuesto && (
                  <div className='flex items-center gap-2 ml-4'>
                    <Label htmlFor='np-itbis' className='text-xs'>% ITBIS:</Label>
                    <Input
                      id='np-itbis'
                      className='h-8 w-24 text-right'
                      type='number'
                      min={0}
                      max={100}
                      step='0.01'
                      value={form.porciento_impuesto}
                      onChange={(e) => setForm((f) => ({ ...f, porciento_impuesto: e.target.value }))}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => { setFormOpen(false); setEditingProdu(null) }} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : editingProdu ? 'Guardar Cambios' : 'Crear Producto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <p className='text-xs text-muted-foreground'>{label}</p>
      <p className={mono ? 'font-mono font-medium' : 'font-medium'}>{value ?? '—'}</p>
    </div>
  )
}
