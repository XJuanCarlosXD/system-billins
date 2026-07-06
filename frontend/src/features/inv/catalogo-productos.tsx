import { useEffect, useState } from 'react'
import { Search, X, ChevronLeft, ChevronRight, History, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCompany } from '@/context/company-context'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
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
  // Empresas + almacenes de CADA empresa, para el picker "Asignar a Almacén(es)"
  // al crear producto. El negocio opera varias cías (01..05), cada una con sus
  // propios almacenes — no basta con los almacenes de la empresa activa.
  interface CiaAlmacenes {
    no_cia: string
    punto: string
    descripcion: string
    almacenes: MovimientosProductoModalAlmacen[]
  }
  const [companiasAlmacenes, setCompaniasAlmacenes] = useState<CiaAlmacenes[]>([])
  const [unidades, setUnidades] = useState<{ unidad: string; descripcion?: string; descri?: string }[]>([])
  const [refsEmpaque, setRefsEmpaque] = useState<{ referencia: string; descripcion?: string; descri?: string }[]>([])

  type EmpaqueRow = {
    empaque: number
    unidad: string
    referencia: string
    cpe: string
    por_defecto: boolean
    para_reporte: boolean
    permite_fraccion: boolean
  }
  const [empaques, setEmpaques] = useState<EmpaqueRow[]>([])

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
    // Detalles legacy FINV111
    upc: '', referencia: '', marca: '', especificaciones: '',
    peso: '', medida: '', maximo_descuento: '',
    porciento_isc: '', porc_otros_impuestos: '',
    permite_desc: true,
    importado: 'L' as 'L' | 'I',  // L=Local, I=Importado
    indi_lote: false,
  }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [detallesOpen, setDetallesOpen] = useState(false)
  // Almacenes (de cualquier empresa) a asignar al crear el producto — solo
  // aplica a creación. Clave = `${no_cia}|${punto}|${almacen}`.
  const [almacenesSel, setAlmacenesSel] = useState<Set<string>>(new Set())
  const toggleAlmacenSel = (key: string) => {
    setAlmacenesSel((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

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

    apiFetch<any>(`/inv/grupos-contables/?no_cia=${selectedCompany}`)
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items ?? data.results ?? []
        setGruposContables(items)
      })
      .catch(() => setGruposContables([]))

    apiFetch<any>(`/inv/unidades/`)
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items ?? data.results ?? []
        setUnidades(items)
      })
      .catch(() => setUnidades([]))

    apiFetch<any>(`/inv/referencias-empaque/`)
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items ?? data.results ?? []
        setRefsEmpaque(items)
      })
      .catch(() => setRefsEmpaque([]))
  }, [selectedCompany, selectedPoint])

  // Empresas activas + sus almacenes, para "Asignar a Almacén(es)" al crear
  // producto — independiente de la compañía seleccionada en el header.
  useEffect(() => {
    apiFetch<any>('/inv/companias/')
      .then(async (data) => {
        const cias = (Array.isArray(data) ? data : data.results ?? [])
          .filter((c: any) => (c.activo ?? 'S') === 'S')
        const withAlmacenes = await Promise.all(
          cias.map(async (c: any) => {
            const no_cia = String(c.no_cia ?? '').trim()
            try {
              const res: any = await regalGeneralApi.invAlmacenes(no_cia)
              const alms = (res?.results ?? [])
                .map((a: any) => ({
                  almacen: String(a.almacen ?? '').trim(),
                  descripcion: (a.descripcion ?? '').trim(),
                  punto: String(a.punto ?? '01').trim(),
                }))
                .filter((a: any) => a.almacen)
              return {
                no_cia,
                punto: alms[0]?.punto || '01',
                descripcion: c.descripcion ?? no_cia,
                almacenes: alms,
              } as CiaAlmacenes
            } catch {
              return { no_cia, punto: '01', descripcion: c.descripcion ?? no_cia, almacenes: [] } as CiaAlmacenes
            }
          })
        )
        setCompaniasAlmacenes(withAlmacenes.filter((c) => c.almacenes.length > 0))
      })
      .catch(() => setCompaniasAlmacenes([]))
  }, [])

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

  const openCreate = async () => {
    setForm(emptyForm)
    setEditingProdu(null)
    setEmpaques([])
    setAlmacenesSel(new Set())
    setFormOpen(true)
    // Auto-pre-fill del codigo desde la secuencia legacy TINV_NEXT_PRODU
    try {
      const next = await apiFetch<{ siguiente?: string }>(`/inv/productos/next-codigo/`)
      if (next?.siguiente) {
        setForm((f) => ({ ...f, no_produ: next.siguiente! }))
      }
    } catch {
      /* preview falla -> el usuario puede tipearlo manualmente */
    }
  }

  const loadEmpaques = async (no_produ: string) => {
    try {
      const r = await apiFetch<{ items?: any[] }>(`/inv/productos/${encodeURIComponent(no_produ)}/empaques-mant/`)
      const items = (r?.items ?? []).map((e: any) => ({
        empaque: Number(e.empaque) || 1,
        unidad: String(e.unidad ?? ''),
        referencia: String(e.referencia ?? ''),
        cpe: String(e.cpe ?? ''),
        por_defecto: (e.por_defecto ?? 'N') === 'S',
        para_reporte: (e.para_reporte ?? 'N') === 'S',
        permite_fraccion: (e.permite_fraccion ?? 'N') === 'S',
      }))
      setEmpaques(items)
    } catch {
      setEmpaques([])
    }
  }

  const addEmpaqueRow = () => {
    setEmpaques((rows) => {
      const next = rows.length + 1
      const firstUni = unidades[0] as any
      const firstRef = refsEmpaque[0] as any
      return [
        ...rows,
        {
          empaque: next,
          unidad: String(firstUni?.cod_unidad ?? firstUni?.unidad ?? ''),
          referencia: String(firstRef?.cod_referencia ?? firstRef?.referencia ?? ''),
          cpe: '1',
          por_defecto: rows.length === 0,  // primer renglón por defecto
          para_reporte: rows.length === 0,
          permite_fraccion: false,
        },
      ]
    })
  }

  const updateEmpaqueRow = (idx: number, patch: Partial<EmpaqueRow>) => {
    setEmpaques((rows) => rows.map((r, i) => {
      if (i !== idx) {
        // Si se está marcando por_defecto/para_reporte en otro, desmarcar este
        const next = { ...r }
        if (patch.por_defecto === true) next.por_defecto = false
        if (patch.para_reporte === true) next.para_reporte = false
        return next
      }
      return { ...r, ...patch }
    }))
  }

  const removeEmpaqueRow = (idx: number) =>
    setEmpaques((rows) => rows.filter((_, i) => i !== idx))

  const openEdit = async (p: Producto) => {
    setEditingProdu(p.no_produ)
    setSelected(null)
    setEmpaques([])
    setFormOpen(true)
    loadEmpaques(p.no_produ)
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
        upc: d.upc ?? '',
        referencia: d.referencia ?? '',
        marca: d.marca ?? '',
        especificaciones: d.especificaciones ?? '',
        peso: d.peso != null ? String(d.peso) : '',
        medida: d.medida != null ? String(d.medida) : '',
        maximo_descuento: d.maximo_descuento != null ? String(d.maximo_descuento) : '',
        porciento_isc: d.porciento_isc != null ? String(d.porciento_isc) : '',
        porc_otros_impuestos: d.porc_otros_impuestos != null ? String(d.porc_otros_impuestos) : '',
        permite_desc: (d.permite_desc ?? 'S') === 'S',
        importado: ((d.importado ?? 'L') === 'I' ? 'I' : 'L') as 'L' | 'I',
        indi_lote: (d.indi_lote ?? 'N') === 'S',
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
        // Detalles legacy FINV111
        upc: form.upc.trim() || null,
        referencia: form.referencia.trim() || null,
        marca: form.marca.trim() || null,
        especificaciones: form.especificaciones.trim() || null,
        peso: form.peso ? parseFloat(form.peso) : null,
        medida: form.medida ? parseFloat(form.medida) : null,
        maximo_descuento: form.maximo_descuento ? parseFloat(form.maximo_descuento) : null,
        porciento_isc: form.porciento_isc ? parseFloat(form.porciento_isc) : null,
        porc_otros_impuestos: form.porc_otros_impuestos ? parseFloat(form.porc_otros_impuestos) : null,
        permite_desc: form.permite_desc ? 'S' : 'N',
        importado: form.importado,  // 'L' o 'I'
        indi_lote: form.indi_lote ? 'S' : 'N',
      }

      const isEdit = !!editingProdu
      const url = isEdit
        ? `${API_BASE}/inv/productos/${encodeURIComponent(editingProdu!)}/`
        : `${API_BASE}/inv/productos/`
      if (!isEdit) {
        body.no_produ = form.no_produ.trim().toUpperCase()
        if (almacenesSel.size > 0) {
          body.asignaciones = Array.from(almacenesSel).map((key) => {
            const [no_cia, punto, almacen] = key.split('|')
            return { no_cia, punto, almacen }
          })
        }
      }

      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

      // Si el usuario definió empaques, los guardamos en una segunda llamada.
      // El backend reemplaza toda la lista (DELETE + INSERT) y valida que
      // haya exactamente 1 por_defecto y 1 para_reporte.
      const savedNoProdu = (data?.data?.no_produ as string | undefined)
        || (isEdit ? editingProdu! : form.no_produ.trim().toUpperCase())
      if (empaques.length > 0) {
        const empRes = await fetch(
          `${API_BASE}/inv/productos/${encodeURIComponent(savedNoProdu)}/empaques-mant/`,
          {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
            body: JSON.stringify({
              empaques: empaques.map((e, i) => ({
                empaque: e.empaque || i + 1,
                unidad: e.unidad,
                referencia: e.referencia,
                cpe: parseFloat(e.cpe) || 0,
                por_defecto: e.por_defecto ? 'S' : 'N',
                para_reporte: e.para_reporte ? 'S' : 'N',
                permite_fraccion: e.permite_fraccion ? 'S' : 'N',
              })),
            }),
          },
        )
        const empData = await empRes.json().catch(() => ({}))
        if (!empRes.ok) {
          // El producto sí se guardó; solo el upsert de empaques falló.
          toast.error(`Producto guardado, pero empaques: ${empData.error || `HTTP ${empRes.status}`}`)
        }
      }

      const asignados: unknown[] = data?.data?.almacenes_asignados ?? []
      toast.success(isEdit
        ? `Producto ${editingProdu} actualizado`
        : asignados.length > 0
          ? `Producto ${savedNoProdu} creado y asignado a ${asignados.length} almacén(es)`
          : `Producto ${savedNoProdu} creado`)
      setFormOpen(false)
      setEditingProdu(null)
      setForm(emptyForm)
      setEmpaques([])
      setAlmacenesSel(new Set())
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
        <DialogContent className='flex flex-col max-w-2xl max-h-[90vh] gap-0 p-0'>
          <DialogHeader className='shrink-0 border-b px-6 py-4'>
            <DialogTitle>{editingProdu ? `Editar Producto ${editingProdu}` : 'Nuevo Producto'}</DialogTitle>
          </DialogHeader>
          <div className='grid grid-cols-2 gap-4 px-6 py-4 overflow-y-auto flex-1'>
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
              <div className='flex items-center justify-between'>
                <Label htmlFor='np-desc'>Descripción <span className='text-destructive'>*</span></Label>
                <span
                  className={`text-xs tabular-nums ${
                    form.descripcion.length > 40
                      ? 'text-destructive font-semibold'
                      : form.descripcion.length >= 35
                        ? 'text-amber-600'
                        : 'text-muted-foreground'
                  }`}
                >
                  {form.descripcion.length} / 40
                </span>
              </div>
              <Input
                id='np-desc'
                className='h-9'
                placeholder='Nombre del producto'
                value={form.descripcion}
                maxLength={40}
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

            {/* Acordeón Detalles del producto (legacy FINV111) */}
            <div className='col-span-2 border-t pt-3 mt-1'>
              <button
                type='button'
                onClick={() => setDetallesOpen((v) => !v)}
                className='flex w-full items-center justify-between text-left text-sm font-medium text-foreground hover:text-primary transition'
              >
                <span>Detalles del producto</span>
                <span className='text-xs text-muted-foreground'>{detallesOpen ? 'Ocultar' : 'Mostrar'}</span>
              </button>
            </div>
            {detallesOpen && (
              <>
                <div className='space-y-1'>
                  <Label htmlFor='np-upc'>Código de Barras (UPC)</Label>
                  <Input id='np-upc' className='h-9 font-mono' maxLength={16}
                    value={form.upc}
                    onChange={(e) => setForm((f) => ({ ...f, upc: e.target.value }))}
                  />
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='np-ref'>Referencia</Label>
                  <Input id='np-ref' className='h-9' maxLength={25}
                    value={form.referencia}
                    onChange={(e) => setForm((f) => ({ ...f, referencia: e.target.value }))}
                  />
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='np-marca'>Marca (código 4 chars)</Label>
                  <Input id='np-marca' className='h-9 font-mono uppercase' maxLength={4}
                    value={form.marca}
                    onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='np-imp'>Clase</Label>
                  <Select value={form.importado} onValueChange={(v) => setForm((f) => ({ ...f, importado: v as 'L' | 'I' }))}>
                    <SelectTrigger id='np-imp' className='h-9'><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='L'>Local</SelectItem>
                      <SelectItem value='I'>Importado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className='col-span-2 space-y-1'>
                  <div className='flex items-center justify-between'>
                    <Label htmlFor='np-esp'>Especificaciones</Label>
                    <span className={`text-xs tabular-nums ${form.especificaciones.length > 100 ? 'text-destructive' : form.especificaciones.length >= 90 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                      {form.especificaciones.length} / 100
                    </span>
                  </div>
                  <Input id='np-esp' className='h-9' maxLength={100}
                    placeholder='Ej. medidas, capacidad, normas técnicas…'
                    value={form.especificaciones}
                    onChange={(e) => setForm((f) => ({ ...f, especificaciones: e.target.value }))}
                  />
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='np-peso'>Peso (Lbs)</Label>
                  <Input id='np-peso' className='h-9 text-right tabular-nums' type='number' step='0.0001'
                    value={form.peso}
                    onChange={(e) => setForm((f) => ({ ...f, peso: e.target.value }))}
                  />
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='np-med'>Medida (Pulgadas)</Label>
                  <Input id='np-med' className='h-9 text-right tabular-nums' type='number' step='0.0001'
                    value={form.medida}
                    onChange={(e) => setForm((f) => ({ ...f, medida: e.target.value }))}
                  />
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='np-maxd'>Máximo Descuento %</Label>
                  <Input id='np-maxd' className='h-9 text-right tabular-nums' type='number' min={0} max={100} step='0.01'
                    value={form.maximo_descuento}
                    onChange={(e) => setForm((f) => ({ ...f, maximo_descuento: e.target.value }))}
                  />
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='np-isc'>% ISC</Label>
                  <Input id='np-isc' className='h-9 text-right tabular-nums' type='number' min={0} max={100} step='0.01'
                    value={form.porciento_isc}
                    onChange={(e) => setForm((f) => ({ ...f, porciento_isc: e.target.value }))}
                  />
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='np-otros'>% Otros Impuestos</Label>
                  <Input id='np-otros' className='h-9 text-right tabular-nums' type='number' min={0} max={100} step='0.01'
                    value={form.porc_otros_impuestos}
                    onChange={(e) => setForm((f) => ({ ...f, porc_otros_impuestos: e.target.value }))}
                  />
                </div>
                <div className='col-span-2 flex flex-wrap items-center gap-6 pt-1'>
                  <div className='flex items-center gap-2'>
                    <Switch
                      checked={form.permite_desc}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, permite_desc: !!v }))}
                    />
                    <Label className='cursor-pointer text-sm'>Permite Descuento</Label>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Switch
                      checked={form.indi_lote}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, indi_lote: !!v }))}
                    />
                    <Label className='cursor-pointer text-sm'>Controlar Lote</Label>
                  </div>
                </div>
              </>
            )}

            {/* Asignar a Almacén(es): crea TINV_EPRODUCTO al mismo tiempo que
                el producto para que quede disponible de inmediato en Entrada
                de Almacén (sin esto, el producto queda "creado pero no
                asignado" y el primer movimiento revienta con parent key
                not found contra TINV_EPRODUCTO). Solo aplica al crear. */}
            {!editingProdu && (
              <div className='col-span-2 border-t pt-3 mt-1 space-y-2'>
                <div>
                  <Label className='text-sm font-medium'>Asignar a Empresa(s) / Almacén(es)</Label>
                  <p className='text-xs text-muted-foreground mt-0.5'>
                    El producto quedará disponible de inmediato en los almacenes marcados, de
                    cualquier empresa. Si no marcas ninguno, deberás asignarlo luego en
                    "Asignar Prod. a Cía./Almacén".
                  </p>
                </div>
                {companiasAlmacenes.length === 0 ? (
                  <p className='text-xs text-muted-foreground rounded border border-dashed py-3 px-3 text-center'>
                    Cargando empresas y almacenes…
                  </p>
                ) : (
                  <div className='space-y-3 rounded border p-3 max-h-64 overflow-y-auto'>
                    {companiasAlmacenes.map((cia) => {
                      const keysCia = cia.almacenes.map((a) => `${cia.no_cia}|${cia.punto}|${a.almacen}`)
                      const todosMarcados = keysCia.length > 0 && keysCia.every((k) => almacenesSel.has(k))
                      return (
                        <div key={cia.no_cia}>
                          <div className='flex items-center justify-between mb-1'>
                            <span className='text-xs font-semibold text-foreground'>
                              {cia.no_cia} — {cia.descripcion}
                            </span>
                            <button
                              type='button'
                              className='text-xs text-primary hover:underline'
                              onClick={() => setAlmacenesSel((prev) => {
                                const next = new Set(prev)
                                if (todosMarcados) keysCia.forEach((k) => next.delete(k))
                                else keysCia.forEach((k) => next.add(k))
                                return next
                              })}
                            >
                              {todosMarcados ? 'Ninguno' : 'Todos'}
                            </button>
                          </div>
                          <div className='flex flex-wrap gap-x-5 gap-y-1.5 pl-1'>
                            {cia.almacenes.map((a) => {
                              const key = `${cia.no_cia}|${cia.punto}|${a.almacen}`
                              return (
                                <label key={key} className='flex items-center gap-2 cursor-pointer text-sm'>
                                  <Checkbox
                                    checked={almacenesSel.has(key)}
                                    onCheckedChange={() => toggleAlmacenSel(key)}
                                  />
                                  <span className='font-mono text-xs'>{a.almacen}</span>
                                  <span className='text-muted-foreground'>{a.descripcion}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Empaques: tabla editable (TINV_EMPAQUE) */}
            <div className='col-span-2 border-t pt-3 mt-1'>
              <div className='flex items-center justify-between mb-2'>
                <div>
                  <Label className='text-sm font-medium'>Empaques</Label>
                  <p className='text-xs text-muted-foreground mt-0.5'>
                    Define unidades de venta (LB, FUNDA, CAJA…) con cantidad por empaque (CPE).
                    Marca uno como <span className='font-semibold'>Por defecto</span> y otro como <span className='font-semibold'>Para reporte</span>.
                  </p>
                </div>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={addEmpaqueRow}
                  className='gap-1 shrink-0'
                  disabled={unidades.length === 0 || refsEmpaque.length === 0}
                >
                  <Plus className='h-3.5 w-3.5' /> Agregar
                </Button>
              </div>
              {empaques.length === 0 ? (
                <p className='text-xs text-muted-foreground rounded border border-dashed py-3 px-3 text-center'>
                  Sin empaques. Si no agregas ninguno, el producto se guardará sin tabla de empaques.
                </p>
              ) : (
                <div className='rounded border overflow-x-auto'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className='w-12'>#</TableHead>
                        <TableHead className='min-w-[110px]'>Unidad</TableHead>
                        <TableHead className='min-w-[110px]'>Referencia</TableHead>
                        <TableHead className='w-24 text-right'>CPE</TableHead>
                        <TableHead className='w-16 text-center'>Defecto</TableHead>
                        <TableHead className='w-16 text-center'>Reporte</TableHead>
                        <TableHead className='w-16 text-center'>Fracción</TableHead>
                        <TableHead className='w-10'></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {empaques.map((e, idx) => (
                        <TableRow key={`emp-${idx}`}>
                          <TableCell className='font-mono text-xs'>{e.empaque || idx + 1}</TableCell>
                          <TableCell>
                            <Select value={e.unidad} onValueChange={(v) => updateEmpaqueRow(idx, { unidad: v })}>
                              <SelectTrigger className='h-8'><SelectValue placeholder='—' /></SelectTrigger>
                              <SelectContent>
                                {unidades.map((u: any) => {
                                  const code = String(u.cod_unidad ?? u.unidad ?? '')
                                  if (!code) return null
                                  return (
                                    <SelectItem key={code} value={code}>
                                      {code} — {u.descripcion ?? u.descri ?? ''}
                                    </SelectItem>
                                  )
                                })}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select value={e.referencia} onValueChange={(v) => updateEmpaqueRow(idx, { referencia: v })}>
                              <SelectTrigger className='h-8'><SelectValue placeholder='—' /></SelectTrigger>
                              <SelectContent>
                                {refsEmpaque.map((r: any) => {
                                  const code = String(r.cod_referencia ?? r.referencia ?? '')
                                  if (!code) return null
                                  return (
                                    <SelectItem key={code} value={code}>
                                      {code} — {r.descripcion ?? r.descri ?? ''}
                                    </SelectItem>
                                  )
                                })}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type='number'
                              min={0.0001}
                              step='0.0001'
                              value={e.cpe}
                              onChange={(ev) => updateEmpaqueRow(idx, { cpe: ev.target.value })}
                              className='h-8 text-right tabular-nums'
                            />
                          </TableCell>
                          <TableCell className='text-center'>
                            <input
                              type='radio'
                              name='emp-defecto'
                              checked={e.por_defecto}
                              onChange={() => updateEmpaqueRow(idx, { por_defecto: true })}
                              className='h-4 w-4 cursor-pointer accent-emerald-600'
                            />
                          </TableCell>
                          <TableCell className='text-center'>
                            <input
                              type='radio'
                              name='emp-reporte'
                              checked={e.para_reporte}
                              onChange={() => updateEmpaqueRow(idx, { para_reporte: true })}
                              className='h-4 w-4 cursor-pointer accent-emerald-600'
                            />
                          </TableCell>
                          <TableCell className='text-center'>
                            <input
                              type='checkbox'
                              checked={e.permite_fraccion}
                              onChange={(ev) => updateEmpaqueRow(idx, { permite_fraccion: ev.target.checked })}
                              className='h-4 w-4 cursor-pointer accent-emerald-600'
                            />
                          </TableCell>
                          <TableCell className='text-right'>
                            <Button
                              size='icon'
                              variant='ghost'
                              type='button'
                              onClick={() => removeEmpaqueRow(idx)}
                              className='h-7 w-7 text-muted-foreground hover:text-destructive'
                              title='Eliminar empaque'
                            >
                              <Trash2 className='h-3.5 w-3.5' />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className='shrink-0 border-t bg-background px-6 py-3'>
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
