// Sidesheet único para crear/editar productos (TINV_PRODUCTO) — usado tanto
// desde el Catálogo de Productos (INV, con edición) como desde cualquier
// picker de producto que ofrezca "crear producto" al no encontrar resultados
// (FAT nueva factura/conduce, Entrada de Compras/Mercancía, ODC). Antes había
// dos formularios distintos: uno completo en catalogo-productos.tsx (empaques,
// precio de venta, asignación a almacenes, detalles legacy) y uno reducido
// aquí (solo clasificación + costo, sin empaque ni precio). Se unificaron en
// este único componente para que "crear producto" pueda hacer todo lo que
// hace la pantalla de Catálogo, sin importar desde dónde se dispare.
import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCurrentUsername } from '@/hooks/use-me'

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

export interface CrearProductoModalResult {
  no_produ: string
  descri: string
  costo: number
  porciento_impuesto: number
  precio?: number
  unidad_empaque?: string
  referencia_empaque?: string
}

interface Props {
  open: boolean
  onClose: () => void
  /** Se llama tras crear el producto con éxito. El caller decide qué hacer
   * con él (seleccionarlo en una fila, en el modal de búsqueda, etc). No se
   * invoca en modo edición — para eso usar `onUpdated`. */
  onCreated: (producto: CrearProductoModalResult) => void
  /** Se llama tras editar un producto existente con éxito. */
  onUpdated?: () => void
  noCia: string
  punto?: string
  /** Prefill de descripción con el texto que el usuario ya había tecleado
   * en el buscador que disparó este modal. Solo aplica al crear. */
  descripcionInicial?: string
  /** Si se define, el sheet abre en modo edición para este no_produ en vez
   * de crear uno nuevo. */
  editingNoProdu?: string | null
}

interface CatalogItem {
  [key: string]: unknown
}

interface DefaultsClasificacion {
  linea: string
  sub_linea: string
  grupo_produ: string
  grupo_contable: string
}

function defaultsKey(usuario: string, noCia: string) {
  return `inv.crearProductoDefaults.${usuario}.${noCia}`
}

function readDefaults(
  usuario: string,
  noCia: string
): DefaultsClasificacion | null {
  if (!usuario) return null
  try {
    const raw = localStorage.getItem(defaultsKey(usuario, noCia))
    return raw ? (JSON.parse(raw) as DefaultsClasificacion) : null
  } catch {
    return null
  }
}

function saveDefaults(
  usuario: string,
  noCia: string,
  d: DefaultsClasificacion
) {
  if (!usuario) return
  try {
    localStorage.setItem(defaultsKey(usuario, noCia), JSON.stringify(d))
  } catch {
    // localStorage no disponible (modo privado, cuota llena) — no es crítico
  }
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** Distintos catálogos INV usan distintas claves para su código (grupo_produ
 * vs grupo vs codigo, etc). Este helper prueba varias en orden. */
function catalogCode(item: CatalogItem, ...keys: string[]): string {
  for (const k of keys) {
    const v = item[k]
    if (v !== undefined && v !== null && v !== '') return String(v)
  }
  return ''
}

interface CiaAlmacenes {
  no_cia: string
  punto: string
  descripcion: string
  almacenes: { almacen: string; descripcion: string }[]
}

type EmpaqueRow = {
  empaque: number
  unidad: string
  referencia: string
  cpe: string
  por_defecto: boolean
  para_reporte: boolean
  permite_fraccion: boolean
}

const emptyForm = {
  descripcion: '',
  linea: '',
  sub_linea: '',
  grupo_produ: '',
  grupo_contable: '',
  servicio: 'I' as 'I' | 'S' | 'K' | 'C',
  tiene_impuesto: true,
  porciento_impuesto: '18',
  costo: '',
  activo: 'S' as 'S' | 'N',
  upc: '',
  referencia: '',
  marca: '',
  especificaciones: '',
  peso: '',
  medida: '',
  maximo_descuento: '',
  porciento_isc: '',
  porc_otros_impuestos: '',
  permite_desc: true,
  importado: 'L' as 'L' | 'I',
  indi_lote: false,
}

export function CrearProductoModal({
  open,
  onClose,
  onCreated,
  onUpdated,
  noCia,
  punto,
  descripcionInicial = '',
  editingNoProdu = null,
}: Props) {
  const usuario = useCurrentUsername()
  const isEdit = !!editingNoProdu

  const [codigoPreview, setCodigoPreview] = useState('')
  const [loadingCodigo, setLoadingCodigo] = useState(false)
  const [autoCodigo, setAutoCodigo] = useState(false)

  const [form, setForm] = useState(emptyForm)
  const [precioVenta, setPrecioVenta] = useState('')
  const [detallesOpen, setDetallesOpen] = useState(false)

  const [lineas, setLineas] = useState<CatalogItem[]>([])
  const [sublineas, setSublineas] = useState<CatalogItem[]>([])
  const [grupos, setGrupos] = useState<CatalogItem[]>([])
  const [gruposContables, setGruposContables] = useState<CatalogItem[]>([])
  const [unidades, setUnidades] = useState<CatalogItem[]>([])
  const [refsEmpaque, setRefsEmpaque] = useState<CatalogItem[]>([])
  const [listaPrecioDefault, setListaPrecioDefault] = useState<{
    no_lista: string
    descripcion: string
  } | null>(null)
  const [companiasAlmacenes, setCompaniasAlmacenes] = useState<CiaAlmacenes[]>(
    []
  )

  const [empaques, setEmpaques] = useState<EmpaqueRow[]>([])
  const [almacenesSel, setAlmacenesSel] = useState<Set<string>>(new Set())
  const toggleAlmacenSel = (key: string) => {
    setAlmacenesSel((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchNextCodigo = async () => {
    setLoadingCodigo(true)
    try {
      const next = await apiFetch<{ siguiente?: string }>(
        '/inv/productos/next-codigo/'
      )
      setCodigoPreview(next?.siguiente ?? '')
      setAutoCodigo(true)
    } catch {
      setCodigoPreview('')
    } finally {
      setLoadingCodigo(false)
    }
  }

  const loadEmpaques = async (no_produ: string) => {
    try {
      const r = await apiFetch<{ items?: any[] }>(
        `/inv/productos/${encodeURIComponent(no_produ)}/empaques-mant/`
      )
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

  // Al abrir: reset del formulario, catálogos, y si es edición, precarga.
  useEffect(() => {
    if (!open) return
    setError('')
    setEmpaques([])
    setAlmacenesSel(new Set())
    setPrecioVenta('')
    setDetallesOpen(false)

    apiFetch<any>(`/inv/grupos/?no_cia=${encodeURIComponent(noCia)}`)
      .then((data) =>
        setGrupos(Array.isArray(data) ? data : (data.items ?? data.results ?? []))
      )
      .catch(() => setGrupos([]))

    apiFetch<any>(`/inv/lineas/?no_cia=${encodeURIComponent(noCia)}`)
      .then((data) =>
        setLineas(Array.isArray(data) ? data : (data.items ?? data.results ?? []))
      )
      .catch(() => setLineas([]))

    apiFetch<any>(`/inv/sublineas/?no_cia=${encodeURIComponent(noCia)}`)
      .then((data) =>
        setSublineas(
          Array.isArray(data) ? data : (data.items ?? data.results ?? [])
        )
      )
      .catch(() => setSublineas([]))

    apiFetch<any>(`/inv/grupos-contables/?no_cia=${encodeURIComponent(noCia)}`)
      .then((data) =>
        setGruposContables(
          Array.isArray(data) ? data : (data.items ?? data.results ?? [])
        )
      )
      .catch(() => setGruposContables([]))

    apiFetch<any>('/inv/unidades/')
      .then((data) =>
        setUnidades(
          Array.isArray(data) ? data : (data.items ?? data.results ?? [])
        )
      )
      .catch(() => setUnidades([]))

    apiFetch<any>('/inv/referencias-empaque/')
      .then((data) =>
        setRefsEmpaque(
          Array.isArray(data) ? data : (data.items ?? data.results ?? [])
        )
      )
      .catch(() => setRefsEmpaque([]))

    regalGeneralApi
      .fatListasPrecio(noCia, punto || '01')
      .then((data: any) => {
        const tipos = data?.tipos ?? []
        const preferida = tipos.find((t: any) => String(t.no_lista) === '01') ?? tipos[0]
        setListaPrecioDefault(
          preferida
            ? { no_lista: String(preferida.no_lista), descripcion: preferida.descripcion || '' }
            : null
        )
      })
      .catch(() => setListaPrecioDefault(null))

    apiFetch<any>('/inv/companias/')
      .then(async (data) => {
        const cias = (Array.isArray(data) ? data : (data.results ?? [])).filter(
          (c: any) => (c.activo ?? 'S') === 'S'
        )
        const withAlmacenes = await Promise.all(
          cias.map(async (c: any) => {
            const cia = String(c.no_cia ?? '').trim()
            try {
              const res: any = await regalGeneralApi.invAlmacenes(cia)
              const alms = (res?.results ?? [])
                .map((a: any) => ({
                  almacen: String(a.almacen ?? '').trim(),
                  descripcion: (a.descripcion ?? '').trim(),
                  punto: String(a.punto ?? '01').trim(),
                }))
                .filter((a: any) => a.almacen)
              return {
                no_cia: cia,
                punto: alms[0]?.punto || '01',
                descripcion: c.descripcion ?? cia,
                almacenes: alms,
              } as CiaAlmacenes
            } catch {
              return {
                no_cia: cia,
                punto: '01',
                descripcion: c.descripcion ?? cia,
                almacenes: [],
              } as CiaAlmacenes
            }
          })
        )
        setCompaniasAlmacenes(withAlmacenes.filter((c) => c.almacenes.length > 0))
      })
      .catch(() => setCompaniasAlmacenes([]))

    if (isEdit && editingNoProdu) {
      loadEmpaques(editingNoProdu)
      apiFetch<any>(`/inv/productos/${encodeURIComponent(editingNoProdu)}/asignaciones/`)
        .then((data) => {
          const rows = data?.results ?? []
          setAlmacenesSel(
            new Set(rows.map((r: any) => `${r.no_cia}|${r.punto}|${r.almacen}`))
          )
        })
        .catch(() => {})
      apiFetch<any>(
        `/inv/productos/${encodeURIComponent(editingNoProdu)}/?no_cia=${encodeURIComponent(noCia)}`
      )
        .then((detail) => {
          const d = detail?.data ?? detail ?? {}
          setForm({
            descripcion: d.descripcion ?? '',
            linea: d.linea ?? '',
            sub_linea: d.sub_linea ?? '',
            grupo_produ: d.grupo_produ ?? d.grupo ?? '',
            grupo_contable: d.grupo_contable ?? '',
            servicio: (d.servicio ?? 'I') as typeof emptyForm.servicio,
            tiene_impuesto: (d.tiene_impuesto ?? 'S') === 'S',
            porciento_impuesto: String(d.porciento_impuesto ?? '18'),
            costo: String(d.costo_mercado_rd ?? d.costo_mercado ?? d.costo ?? ''),
            activo: ((d.activo ?? 'S') === 'N' ? 'N' : 'S') as 'S' | 'N',
            upc: d.upc ?? '',
            referencia: d.referencia ?? '',
            marca: d.marca ?? '',
            especificaciones: d.especificaciones ?? '',
            peso: d.peso != null ? String(d.peso) : '',
            medida: d.medida != null ? String(d.medida) : '',
            maximo_descuento: d.maximo_descuento != null ? String(d.maximo_descuento) : '',
            porciento_isc: d.porciento_isc != null ? String(d.porciento_isc) : '',
            porc_otros_impuestos:
              d.porc_otros_impuestos != null ? String(d.porc_otros_impuestos) : '',
            permite_desc: (d.permite_desc ?? 'S') === 'S',
            importado: ((d.importado ?? 'L') === 'I' ? 'I' : 'L') as 'L' | 'I',
            indi_lote: (d.indi_lote ?? 'N') === 'S',
          })
        })
        .catch((err: any) => setError(err?.message ?? 'No se pudo cargar el producto'))
    } else {
      setForm({ ...emptyForm, descripcion: descripcionInicial })
      setCodigoPreview('')
      setAutoCodigo(false)
      fetchNextCodigo()
      const defaults = readDefaults(usuario, noCia)
      if (defaults) {
        setForm((f) => ({
          ...f,
          linea: defaults.linea,
          sub_linea: defaults.sub_linea,
          grupo_produ: defaults.grupo_produ,
          grupo_contable: defaults.grupo_contable,
        }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, noCia, editingNoProdu])

  const sublineasFiltradas = form.linea
    ? sublineas.filter((s) => String(s.linea) === String(form.linea))
    : sublineas

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
          por_defecto: rows.length === 0,
          para_reporte: rows.length === 0,
          permite_fraccion: false,
        },
      ]
    })
  }

  const updateEmpaqueRow = (idx: number, patch: Partial<EmpaqueRow>) => {
    setEmpaques((rows) =>
      rows.map((r, i) => {
        if (i !== idx) {
          const next = { ...r }
          if (patch.por_defecto === true) next.por_defecto = false
          if (patch.para_reporte === true) next.para_reporte = false
          return next
        }
        return { ...r, ...patch }
      })
    )
  }

  const removeEmpaqueRow = (idx: number) =>
    setEmpaques((rows) => rows.filter((_, i) => i !== idx))

  const handleGuardar = async () => {
    setError('')
    if (!isEdit && !codigoPreview) return setError('Aún generando el código, espere un momento')
    if (!form.descripcion.trim()) return setError('La descripción es requerida')
    if (form.descripcion.trim().length > 40)
      return setError('La descripción supera los 40 caracteres')
    if (!form.linea) return setError('Seleccione la línea')
    if (!form.sub_linea) return setError('Seleccione la sub-línea')
    if (!form.grupo_produ) return setError('Seleccione el grupo')
    if (!form.grupo_contable) return setError('Seleccione el grupo contable')

    setSaving(true)
    try {
      const csrf =
        (
          document.cookie.split('; ').find((c) => c.startsWith('csrftoken=')) ||
          ''
        ).split('=')[1] || ''
      const body: any = {
        descripcion: form.descripcion.trim(),
        linea: form.linea,
        sub_linea: form.sub_linea,
        grupo_produ: form.grupo_produ,
        grupo_contable: form.grupo_contable,
        servicio: form.servicio,
        tiene_impuesto: form.tiene_impuesto ? 'S' : 'N',
        porciento_impuesto: form.tiene_impuesto ? parseFloat(form.porciento_impuesto) || 0 : 0,
        costo: parseFloat(form.costo) || 0,
        activo: form.activo,
        upc: form.upc.trim() || null,
        referencia: form.referencia.trim() || null,
        marca: form.marca.trim() || null,
        especificaciones: form.especificaciones.trim() || null,
        peso: form.peso ? parseFloat(form.peso) : null,
        medida: form.medida ? parseFloat(form.medida) : null,
        maximo_descuento: form.maximo_descuento ? parseFloat(form.maximo_descuento) : null,
        porciento_isc: form.porciento_isc ? parseFloat(form.porciento_isc) : null,
        porc_otros_impuestos: form.porc_otros_impuestos
          ? parseFloat(form.porc_otros_impuestos)
          : null,
        permite_desc: form.permite_desc ? 'S' : 'N',
        importado: form.importado,
        indi_lote: form.indi_lote ? 'S' : 'N',
      }
      if (!isEdit) {
        body.no_produ = codigoPreview
        body.codigo_auto = autoCodigo ? 'S' : 'N'
      }
      if (almacenesSel.size > 0) {
        body.asignaciones = Array.from(almacenesSel).map((key) => {
          const [cia, pto, almacen] = key.split('|')
          return { no_cia: cia, punto: pto, almacen }
        })
      }

      const url = isEdit
        ? `${API_BASE}/inv/productos/${encodeURIComponent(editingNoProdu!)}/`
        : `${API_BASE}/inv/productos/`
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? data.detail ?? `HTTP ${res.status}`)
        return
      }

      const savedNoProdu: string =
        data?.data?.no_produ ?? (isEdit ? editingNoProdu! : codigoPreview)

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
          }
        )
        const empData = await empRes.json().catch(() => ({}))
        if (!empRes.ok) {
          toast.error(`Producto guardado, pero empaques: ${empData.error || `HTTP ${empRes.status}`}`)
        }
      }

      if (!isEdit && precioVenta.trim() && listaPrecioDefault) {
        try {
          await regalGeneralApi.fatUpsertListaPrecio({
            kind: 'detalle',
            no_cia: noCia,
            punto: punto || '01',
            no_lista: listaPrecioDefault.no_lista,
            no_produ: savedNoProdu,
            precio: parseFloat(precioVenta) || 0,
          })
        } catch (err: any) {
          toast.error(`Producto guardado, pero el precio no se pudo asignar: ${err?.message || err}`)
        }
      }

      if (!isEdit) {
        saveDefaults(usuario, noCia, {
          linea: form.linea,
          sub_linea: form.sub_linea,
          grupo_produ: form.grupo_produ,
          grupo_contable: form.grupo_contable,
        })
      }

      const asignados: unknown[] = data?.data?.almacenes_asignados ?? []
      const sufijo = asignados.length > 0 ? ` (${asignados.length} almacén(es) asignado(s))` : ''
      toast.success(isEdit ? `Producto ${savedNoProdu} actualizado${sufijo}` : `Producto ${savedNoProdu} creado${sufijo}`)

      const primerEmpaque = empaques.find((e) => e.por_defecto) ?? empaques[0]
      const primerRef = refsEmpaque.find(
        (r: any) => catalogCode(r, 'cod_referencia', 'referencia') === primerEmpaque?.referencia
      ) as any

      if (isEdit) {
        onUpdated?.()
      } else {
        onCreated({
          no_produ: savedNoProdu,
          descri: form.descripcion.trim(),
          costo: parseFloat(form.costo) || 0,
          porciento_impuesto: form.tiene_impuesto ? parseFloat(form.porciento_impuesto) || 0 : 0,
          precio: precioVenta.trim() ? parseFloat(precioVenta) || 0 : undefined,
          unidad_empaque: primerEmpaque?.unidad || undefined,
          referencia_empaque: primerRef
            ? catalogCode(primerRef, 'cod_referencia', 'referencia')
            : undefined,
        })
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error desconocido al guardar el producto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <SheetContent size='lg' className='sm:max-w-2xl'>
        <SheetHeader>
          <SheetTitle>
            {isEdit ? `Editar Producto ${editingNoProdu}` : 'Crear Producto'}
          </SheetTitle>
        </SheetHeader>

        <div className='grid flex-1 grid-cols-1 gap-4 overflow-y-auto px-6 py-4 sm:grid-cols-2'>
          <div className='space-y-1'>
            <Label htmlFor='cp-codigo'>No. Producto</Label>
            <div className='flex items-center gap-2'>
              <Input
                id='cp-codigo'
                className='h-9 font-mono uppercase disabled:opacity-100 disabled:bg-muted'
                value={isEdit ? editingNoProdu! : loadingCodigo ? 'Generando...' : codigoPreview}
                readOnly
                disabled
              />
              {!isEdit && (
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  className='h-9 shrink-0'
                  disabled={loadingCodigo}
                  onClick={fetchNextCodigo}
                  title='Generar otro código'
                >
                  {loadingCodigo ? '...' : 'Regenerar'}
                </Button>
              )}
            </div>
            <p className='text-[11px] text-muted-foreground'>
              {isEdit ? 'No editable.' : 'Código autogenerado por el sistema.'}
            </p>
          </div>

          <div className='space-y-1'>
            <Label htmlFor='cp-activo'>Estado</Label>
            <Select
              value={form.activo}
              onValueChange={(v) => setForm((f) => ({ ...f, activo: v as 'S' | 'N' }))}
            >
              <SelectTrigger id='cp-activo' className='h-9'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='S'>Activo</SelectItem>
                <SelectItem value='N'>Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='col-span-1 space-y-1 sm:col-span-2'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='cp-descripcion'>
                Descripción <span className='text-destructive'>*</span>
              </Label>
              <span className='text-[11px] text-muted-foreground tabular-nums'>
                {form.descripcion.length}/40
              </span>
            </div>
            <Input
              id='cp-descripcion'
              className='h-9'
              placeholder='Nombre del producto'
              value={form.descripcion}
              maxLength={40}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              autoFocus
            />
          </div>

          <div className='space-y-1'>
            <Label htmlFor='cp-grupo'>
              Grupo <span className='text-destructive'>*</span>
            </Label>
            <Select
              value={form.grupo_produ}
              onValueChange={(v) => setForm((f) => ({ ...f, grupo_produ: v }))}
            >
              <SelectTrigger id='cp-grupo' className='h-9'>
                <SelectValue placeholder='Seleccionar...' />
              </SelectTrigger>
              <SelectContent>
                {grupos.map((g) => {
                  const code = catalogCode(g, 'grupo_produ', 'grupo', 'codigo')
                  return (
                    <SelectItem key={code} value={code}>
                      {code} — {String(g.descripcion ?? '')}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-1'>
            <Label htmlFor='cp-gc'>
              Grupo Contable <span className='text-destructive'>*</span>
            </Label>
            <Select
              value={form.grupo_contable}
              onValueChange={(v) => setForm((f) => ({ ...f, grupo_contable: v }))}
            >
              <SelectTrigger id='cp-gc' className='h-9'>
                <SelectValue placeholder='Seleccionar...' />
              </SelectTrigger>
              <SelectContent>
                {gruposContables.map((g) => {
                  const code = catalogCode(g, 'grupo_contable', 'codigo')
                  return (
                    <SelectItem key={code} value={code}>
                      {code} — {String(g.descripcion ?? '')}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-1'>
            <Label htmlFor='cp-linea'>
              Línea <span className='text-destructive'>*</span>
            </Label>
            <Select
              value={form.linea}
              onValueChange={(v) => setForm((f) => ({ ...f, linea: v, sub_linea: '' }))}
            >
              <SelectTrigger id='cp-linea' className='h-9'>
                <SelectValue placeholder='Seleccionar...' />
              </SelectTrigger>
              <SelectContent>
                {lineas.map((l) => {
                  const code = catalogCode(l, 'linea', 'codigo')
                  return (
                    <SelectItem key={code} value={code}>
                      {code} — {String(l.descripcion ?? '')}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-1'>
            <Label htmlFor='cp-subl'>
              Sub-Línea <span className='text-destructive'>*</span>
            </Label>
            <Select
              value={form.sub_linea}
              onValueChange={(v) => setForm((f) => ({ ...f, sub_linea: v }))}
              disabled={!form.linea}
            >
              <SelectTrigger id='cp-subl' className='h-9'>
                <SelectValue placeholder={form.linea ? 'Seleccionar...' : 'Elija línea primero'} />
              </SelectTrigger>
              <SelectContent>
                {sublineasFiltradas.map((s) => {
                  const code = catalogCode(s, 'sub_linea', 'codigo')
                  return (
                    <SelectItem key={code} value={code}>
                      {code} — {String(s.descripcion ?? '')}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-1'>
            <Label htmlFor='cp-tipo'>Tipo</Label>
            <Select
              value={form.servicio}
              onValueChange={(v) => setForm((f) => ({ ...f, servicio: v as typeof emptyForm.servicio }))}
            >
              <SelectTrigger id='cp-tipo' className='h-9'>
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
            <Label htmlFor='cp-costo'>Costo referencial</Label>
            <Input
              id='cp-costo'
              type='number'
              min={0}
              step='0.01'
              className='h-9 text-right tabular-nums'
              placeholder='0.00'
              value={form.costo}
              onChange={(e) => setForm((f) => ({ ...f, costo: e.target.value }))}
            />
          </div>

          {!isEdit && (
            <div className='space-y-1'>
              <Label htmlFor='cp-precio'>Precio de Venta (RD$)</Label>
              <Input
                id='cp-precio'
                type='number'
                min={0}
                step='0.01'
                className='h-9 text-right tabular-nums'
                placeholder='0.00'
                value={precioVenta}
                onChange={(e) => setPrecioVenta(e.target.value)}
                disabled={!listaPrecioDefault}
              />
              <p className='text-[11px] text-muted-foreground'>
                {listaPrecioDefault
                  ? `Se asigna directo a la lista ${listaPrecioDefault.no_lista} — ${listaPrecioDefault.descripcion}. Déjalo en blanco para asignarlo después.`
                  : 'No hay lista de precios configurada. Créala en FAT › Listas de Precio.'}
              </p>
            </div>
          )}

          <div className='col-span-1 space-y-1 sm:col-span-2'>
            <div className='flex flex-wrap items-center gap-3'>
              <Checkbox
                id='cp-itbis'
                checked={form.tiene_impuesto}
                onCheckedChange={(v) => setForm((f) => ({ ...f, tiene_impuesto: v === true }))}
              />
              <Label htmlFor='cp-itbis' className='cursor-pointer'>
                Aplica ITBIS
              </Label>
              {form.tiene_impuesto && (
                <div className='flex items-center gap-2 sm:ml-4'>
                  <Label htmlFor='cp-itbis-pct' className='text-xs'>
                    % ITBIS:
                  </Label>
                  <Input
                    id='cp-itbis-pct'
                    type='number'
                    min={0}
                    max={100}
                    step='0.01'
                    className='h-8 w-20 text-right tabular-nums'
                    value={form.porciento_impuesto}
                    onChange={(e) => setForm((f) => ({ ...f, porciento_impuesto: e.target.value }))}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Detalles del producto (legacy FINV111) */}
          <div className='col-span-1 mt-1 border-t pt-3 sm:col-span-2'>
            <button
              type='button'
              onClick={() => setDetallesOpen((v) => !v)}
              className='flex w-full items-center justify-between text-left text-sm font-medium text-foreground transition hover:text-primary'
            >
              <span>Detalles del producto</span>
              <span className='text-xs text-muted-foreground'>{detallesOpen ? 'Ocultar' : 'Mostrar'}</span>
            </button>
          </div>
          {detallesOpen && (
            <>
              <div className='space-y-1'>
                <Label htmlFor='cp-upc'>Código de Barras (UPC)</Label>
                <Input
                  id='cp-upc'
                  className='h-9 font-mono'
                  maxLength={16}
                  value={form.upc}
                  onChange={(e) => setForm((f) => ({ ...f, upc: e.target.value }))}
                />
              </div>
              <div className='space-y-1'>
                <Label htmlFor='cp-ref'>Referencia</Label>
                <Input
                  id='cp-ref'
                  className='h-9'
                  maxLength={25}
                  value={form.referencia}
                  onChange={(e) => setForm((f) => ({ ...f, referencia: e.target.value }))}
                />
              </div>
              <div className='space-y-1'>
                <Label htmlFor='cp-marca'>Marca (código 4 chars)</Label>
                <Input
                  id='cp-marca'
                  className='h-9 font-mono uppercase'
                  maxLength={4}
                  value={form.marca}
                  onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value.toUpperCase() }))}
                />
              </div>
              <div className='space-y-1'>
                <Label htmlFor='cp-imp'>Clase</Label>
                <Select
                  value={form.importado}
                  onValueChange={(v) => setForm((f) => ({ ...f, importado: v as 'L' | 'I' }))}
                >
                  <SelectTrigger id='cp-imp' className='h-9'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='L'>Local</SelectItem>
                    <SelectItem value='I'>Importado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='col-span-1 space-y-1 sm:col-span-2'>
                <div className='flex items-center justify-between'>
                  <Label htmlFor='cp-esp'>Especificaciones</Label>
                  <span className='text-[11px] text-muted-foreground tabular-nums'>
                    {form.especificaciones.length}/100
                  </span>
                </div>
                <Input
                  id='cp-esp'
                  className='h-9'
                  maxLength={100}
                  placeholder='Ej. medidas, capacidad, normas técnicas…'
                  value={form.especificaciones}
                  onChange={(e) => setForm((f) => ({ ...f, especificaciones: e.target.value }))}
                />
              </div>
              <div className='space-y-1'>
                <Label htmlFor='cp-peso'>Peso (Lbs)</Label>
                <Input
                  id='cp-peso'
                  className='h-9 text-right tabular-nums'
                  type='number'
                  step='0.0001'
                  value={form.peso}
                  onChange={(e) => setForm((f) => ({ ...f, peso: e.target.value }))}
                />
              </div>
              <div className='space-y-1'>
                <Label htmlFor='cp-med'>Medida (Pulgadas)</Label>
                <Input
                  id='cp-med'
                  className='h-9 text-right tabular-nums'
                  type='number'
                  step='0.0001'
                  value={form.medida}
                  onChange={(e) => setForm((f) => ({ ...f, medida: e.target.value }))}
                />
              </div>
              <div className='space-y-1'>
                <Label htmlFor='cp-maxd'>Máximo Descuento %</Label>
                <Input
                  id='cp-maxd'
                  className='h-9 text-right tabular-nums'
                  type='number'
                  min={0}
                  max={100}
                  step='0.01'
                  value={form.maximo_descuento}
                  onChange={(e) => setForm((f) => ({ ...f, maximo_descuento: e.target.value }))}
                />
              </div>
              <div className='space-y-1'>
                <Label htmlFor='cp-isc'>% ISC</Label>
                <Input
                  id='cp-isc'
                  className='h-9 text-right tabular-nums'
                  type='number'
                  min={0}
                  max={100}
                  step='0.01'
                  value={form.porciento_isc}
                  onChange={(e) => setForm((f) => ({ ...f, porciento_isc: e.target.value }))}
                />
              </div>
              <div className='space-y-1'>
                <Label htmlFor='cp-otros'>% Otros Impuestos</Label>
                <Input
                  id='cp-otros'
                  className='h-9 text-right tabular-nums'
                  type='number'
                  min={0}
                  max={100}
                  step='0.01'
                  value={form.porc_otros_impuestos}
                  onChange={(e) => setForm((f) => ({ ...f, porc_otros_impuestos: e.target.value }))}
                />
              </div>
              <div className='col-span-1 flex flex-wrap items-center gap-6 pt-1 sm:col-span-2'>
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

          {/* Asignar a Empresa(s)/Almacén(es) */}
          <div className='col-span-1 mt-1 space-y-2 border-t pt-3 sm:col-span-2'>
            <div>
              <Label className='text-sm font-medium'>Asignar a Empresa(s) / Almacén(es)</Label>
              <p className='mt-0.5 text-xs text-muted-foreground'>
                El producto quedará disponible de inmediato en los almacenes marcados, de cualquier empresa.
              </p>
            </div>
            {companiasAlmacenes.length === 0 ? (
              <p className='rounded border border-dashed px-3 py-3 text-center text-xs text-muted-foreground'>
                Cargando empresas y almacenes…
              </p>
            ) : (
              <div className='max-h-64 space-y-3 overflow-y-auto rounded border p-3'>
                {companiasAlmacenes.map((cia) => {
                  const keysCia = cia.almacenes.map((a) => `${cia.no_cia}|${cia.punto}|${a.almacen}`)
                  const todosMarcados = keysCia.length > 0 && keysCia.every((k) => almacenesSel.has(k))
                  return (
                    <div key={cia.no_cia}>
                      <div className='mb-1 flex items-center justify-between'>
                        <span className='text-xs font-semibold text-foreground'>
                          {cia.no_cia} — {cia.descripcion}
                        </span>
                        <button
                          type='button'
                          className='text-xs text-primary hover:underline'
                          onClick={() =>
                            setAlmacenesSel((prev) => {
                              const next = new Set(prev)
                              if (todosMarcados) keysCia.forEach((k) => next.delete(k))
                              else keysCia.forEach((k) => next.add(k))
                              return next
                            })
                          }
                        >
                          {todosMarcados ? 'Ninguno' : 'Todos'}
                        </button>
                      </div>
                      <div className='flex flex-wrap gap-x-5 gap-y-1.5 pl-1'>
                        {cia.almacenes.map((a) => {
                          const key = `${cia.no_cia}|${cia.punto}|${a.almacen}`
                          return (
                            <label key={key} className='flex cursor-pointer items-center gap-2 text-sm'>
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

          {/* Empaques */}
          <div className='col-span-1 mt-1 border-t pt-3 sm:col-span-2'>
            <div className='mb-2 flex items-center justify-between'>
              <div>
                <Label className='text-sm font-medium'>Empaques</Label>
                <p className='mt-0.5 text-xs text-muted-foreground'>
                  Define unidades de venta (LB, FUNDA, CAJA…) con cantidad por empaque (CPE). Marca uno
                  como <span className='font-semibold'>Por defecto</span> y otro como{' '}
                  <span className='font-semibold'>Para reporte</span>.
                </p>
              </div>
              <Button
                type='button'
                size='sm'
                variant='outline'
                onClick={addEmpaqueRow}
                className='shrink-0 gap-1'
                disabled={unidades.length === 0 || refsEmpaque.length === 0}
              >
                <Plus className='h-3.5 w-3.5' /> Agregar
              </Button>
            </div>
            {empaques.length === 0 ? (
              <p className='rounded border border-dashed px-3 py-3 text-center text-xs text-muted-foreground'>
                Sin empaques. Si no agregas ninguno, el producto se guardará sin tabla de empaques.
              </p>
            ) : (
              <div className='overflow-x-auto rounded border'>
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
                      <TableHead className='w-10' />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empaques.map((e, idx) => (
                      <TableRow key={`emp-${idx}`}>
                        <TableCell className='font-mono text-xs'>{e.empaque || idx + 1}</TableCell>
                        <TableCell>
                          <Select value={e.unidad} onValueChange={(v) => updateEmpaqueRow(idx, { unidad: v })}>
                            <SelectTrigger className='h-8'>
                              <SelectValue placeholder='—' />
                            </SelectTrigger>
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
                          <Select
                            value={e.referencia}
                            onValueChange={(v) => updateEmpaqueRow(idx, { referencia: v })}
                          >
                            <SelectTrigger className='h-8'>
                              <SelectValue placeholder='—' />
                            </SelectTrigger>
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
                            name='cp-emp-defecto'
                            checked={e.por_defecto}
                            onChange={() => updateEmpaqueRow(idx, { por_defecto: true })}
                            className='h-4 w-4 cursor-pointer accent-emerald-600'
                          />
                        </TableCell>
                        <TableCell className='text-center'>
                          <input
                            type='radio'
                            name='cp-emp-reporte'
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

          {error && <p className='col-span-1 text-sm text-destructive sm:col-span-2'>{error}</p>}
        </div>

        <SheetFooter>
          <Button variant='outline' onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={saving || (!isEdit && loadingCodigo)}>
            {saving ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear y continuar'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
