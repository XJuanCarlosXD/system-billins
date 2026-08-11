import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import {
  X, FileText, ExternalLink, ArrowDownToLine, ArrowUpFromLine,
  ArrowLeftRight, Minus, Package, TrendingUp, TrendingDown, Wallet, Search, Pencil,
} from 'lucide-react'
import { useCompany } from '@/context/company-context'
import { useDocHighlightCount } from '@/hooks/use-sidebar-badges'
import { HIGHLIGHT_ROW_CLASS } from '@/lib/sidebar-badges'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

const invRoute = getRouteApi('/_authenticated/inv')

interface Documento {
  tipo_docu: string
  no_docu: string | number
  fecha?: string
  punto?: string
  desc_punto?: string
  almacen?: string
  desc_almacen?: string
  desc_tipo_docu?: string
  tipo_movi?: string
  tipo_transaccion?: string
  estado?: string
  st_anulado?: string
  total?: number
  lineas?: number
  [key: string]: any
}

interface DocumentoDetalle {
  header: Record<string, any>
  lines?: Array<Record<string, any>>
  lineas?: Array<Record<string, any>>
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

const TIPO_MOVI_LABEL: Record<string, string> = {
  E: 'Entrada', S: 'Salida', T: 'Transferencia',
}

const TIPO_TRANS_LABEL: Record<string, string> = {
  C: 'Compra', V: 'Venta', D: 'Devolución', E: 'Entrada Almacén',
  S: 'Salida Almacén', T: 'Transferencia', J: 'Ajuste',
  P: 'Producción', M: 'Movimiento Interno', R: 'Reverso',
  A: 'Ajuste Físico', F: 'Factura',
}

const ESTADO_LABEL: Record<string, string> = {
  A: 'Autorizado', P: 'Pendiente', C: 'Cerrado', N: 'Anulado',
}

const TIPO_DOCU_FALLBACK: Record<string, string> = {
  AE: 'Ajuste de Entrada',
  AF: 'Ajuste Físico',
  AS: 'Ajuste de Salida',
  DC: 'Devolución de Compra',
  DV: 'Devolución',
  EA: 'Entrada de Almacén',
  EC: 'Entrada de Compra',
  EP: 'Entrada de Producción',
  SA: 'Salida de Almacén',
  SP: 'Salida de Producción',
  TA: 'Transferencia de Almacén',
  // Tipos originados en FAT/CxC que impactan inventario (no viven en TINV_TDOCU,
  // por eso el endpoint /inv/tipos-docu/ no los devuelve, pero sí aparecen en
  // TINV_MOVIMIENTO y el usuario los necesita seleccionar).
  FT: 'Factura',
  FC: 'Factura Contado',
  CO: 'Conduce',
  CT: 'Cotización',
}

function tipoMoviIcon(tipo: string | undefined) {
  const t = (tipo || '').toUpperCase()
  if (t === 'E') return <ArrowDownToLine className='h-4 w-4 text-emerald-600' />
  if (t === 'S') return <ArrowUpFromLine className='h-4 w-4 text-orange-600' />
  if (t === 'T') return <ArrowLeftRight className='h-4 w-4 text-sky-600' />
  return <Minus className='h-4 w-4 text-muted-foreground' />
}

function estadoBadge(estado: string | undefined, anulado?: string) {
  const u = (estado || '').toUpperCase()
  if ((anulado || '').toUpperCase() === 'S' || u === 'N')
    return <Badge variant='destructive' className='text-[10px] uppercase'>Anulado</Badge>
  const label = ESTADO_LABEL[u] || estado || '—'
  if (u === 'A')
    return <Badge className='bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] uppercase'>{label}</Badge>
  if (u === 'P')
    return <Badge className='bg-amber-500 hover:bg-amber-500 text-white text-[10px] uppercase'>{label}</Badge>
  if (u === 'C')
    return <Badge variant='secondary' className='text-[10px] uppercase'>{label}</Badge>
  return <Badge variant='outline' className='text-[10px] uppercase'>{label}</Badge>
}

function fmt(n?: number) {
  return n == null
    ? '—'
    : Number(n).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(s?: string) {
  if (!s) return '—'
  const d = s.slice(0, 10)
  if (d.length !== 10) return d
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
}

function fmtCombo(code: string | number | undefined, desc: string | undefined) {
  const c = code != null ? String(code).trim() : ''
  const d = desc ? String(desc).trim() : ''
  if (c && d) return `${c} - ${d}`
  return d || c || '—'
}

function tipoDocuLabel(doc: Pick<Documento, 'tipo_docu' | 'desc_tipo_docu'>) {
  return doc.desc_tipo_docu
    || TIPO_DOCU_FALLBACK[(doc.tipo_docu || '').toUpperCase()]
    || doc.tipo_docu
    || '—'
}

function tipoMoviColor(tipo: string | undefined) {
  const t = (tipo || '').toUpperCase()
  if (t === 'E') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (t === 'S') return 'bg-orange-50 text-orange-700 border-orange-200'
  if (t === 'T') return 'bg-sky-50 text-sky-700 border-sky-200'
  return 'bg-muted text-foreground border-border'
}

// ─── KPI cards ────────────────────────────────────────────────────────────
function KpiCards({ rows }: { rows: Documento[] }) {
  const stats = useMemo(() => {
    let entradas = 0, salidas = 0, transf = 0
    let sumEnt = 0, sumSal = 0, sumTot = 0
    for (const r of rows) {
      const total = Number(r.total) || 0
      sumTot += total
      const m = (r.tipo_movi || '').toUpperCase()
      if (m === 'E') { entradas++; sumEnt += total }
      else if (m === 'S') { salidas++; sumSal += total }
      else if (m === 'T') { transf++ }
    }
    return { total: rows.length, entradas, salidas, transf, sumEnt, sumSal, sumTot }
  }, [rows])

  const cards = [
    {
      icon: <Package className='h-4 w-4' />,
      label: 'Documentos',
      value: stats.total.toString(),
      sub: stats.transf ? `${stats.transf} transferencias` : 'en el período',
      tone: 'text-slate-600',
      bg: 'bg-slate-50',
    },
    {
      icon: <TrendingDown className='h-4 w-4' />,
      label: 'Entradas',
      value: stats.entradas.toString(),
      sub: `RD$ ${fmt(stats.sumEnt)}`,
      tone: 'text-emerald-700',
      bg: 'bg-emerald-50',
    },
    {
      icon: <TrendingUp className='h-4 w-4' />,
      label: 'Salidas',
      value: stats.salidas.toString(),
      sub: `RD$ ${fmt(stats.sumSal)}`,
      tone: 'text-orange-700',
      bg: 'bg-orange-50',
    },
    {
      icon: <Wallet className='h-4 w-4' />,
      label: 'Total Neto',
      value: `RD$ ${fmt(stats.sumTot)}`,
      sub: 'sumatoria del filtro',
      tone: 'text-sky-700',
      bg: 'bg-sky-50',
    },
  ]

  return (
    <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-lg border ${c.bg} px-4 py-3 flex items-start gap-3`}
        >
          <div className={`mt-0.5 ${c.tone}`}>{c.icon}</div>
          <div className='min-w-0'>
            <div className='text-[11px] uppercase tracking-wide text-muted-foreground font-medium'>
              {c.label}
            </div>
            <div className={`text-base font-semibold leading-tight ${c.tone}`}>
              {c.value}
            </div>
            <div className='text-[11px] text-muted-foreground truncate'>{c.sub}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Header info-grid (panel detalle) ─────────────────────────────────────
function InfoBlock({ title, rows, span }: {
  title: string
  rows: Array<[string, React.ReactNode]>
  span?: boolean
}) {
  if (!rows.length) return null
  return (
    <div className={`rounded-md border bg-muted/30 ${span ? 'col-span-2' : ''}`}>
      <div className='px-3 py-1.5 border-b text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>
        {title}
      </div>
      <dl className='px-3 py-2 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-xs'>
        {rows.map(([k, v]) => (
          <>
            <dt key={`k-${k}`} className='text-muted-foreground'>{k}</dt>
            <dd key={`v-${k}`} className='font-medium text-foreground break-words'>{v ?? '—'}</dd>
          </>
        ))}
      </dl>
    </div>
  )
}

function DocumentoInfoGrid({ header, fallback }: {
  header: Record<string, any>
  fallback?: Documento
}) {
  const h = header || {}
  const tipoMovi = String(h.tipo_movi || fallback?.tipo_movi || '').toUpperCase()
  const tipoTrans = String(h.tipo_transaccion || fallback?.tipo_transaccion || '').toUpperCase()
  const estado = String(h.estado || fallback?.estado || '').toUpperCase()
  const isAnulado = String(h.st_anulado || fallback?.st_anulado || 'N').toUpperCase() === 'S'

  const docRows: Array<[string, React.ReactNode]> = [
    ['Punto', fmtCombo(h.punto || fallback?.punto, h.punto_descripcion || (fallback as any)?.desc_punto)],
    ['Almacén', fmtCombo(h.almacen || fallback?.almacen, h.almacen_descripcion || fallback?.desc_almacen)],
  ]
  if (h.no_localidad || h.localidad_descripcion)
    docRows.push(['Localidad', fmtCombo(h.no_localidad, h.localidad_descripcion)])
  docRows.push(['Fecha', fmtDate(h.fecha || fallback?.fecha)])
  if (h.conduce) docRows.push(['Conduce', h.conduce])

  const movRows: Array<[string, React.ReactNode]> = [
    ['Tipo Doc.', tipoDocuLabel({ tipo_docu: h.tipo_docu || fallback?.tipo_docu, desc_tipo_docu: h.tipo_docu_descri || fallback?.desc_tipo_docu })],
    ['Movimiento', TIPO_MOVI_LABEL[tipoMovi] || tipoMovi || '—'],
    ['Transacción', TIPO_TRANS_LABEL[tipoTrans] || tipoTrans || '—'],
    ['Estado', isAnulado
      ? <span className='text-destructive font-semibold'>ANULADO</span>
      : (ESTADO_LABEL[estado] || estado || '—')],
  ]
  if (h.usuario) movRows.push(['Usuario', h.usuario])
  if (String(h.st_impresion || 'N').toUpperCase() === 'S')
    movRows.push(['Marca', 'Reimpresión'])

  const odRows: Array<[string, React.ReactNode]> = []
  if (h.no_proveedor) {
    odRows.push(['Proveedor', `${h.no_proveedor} - ${h.proveedor_nombre || ''}`])
    if (h.proveedor_rnc) odRows.push(['RNC', h.proveedor_rnc])
  }
  if (h.no_cliente) {
    odRows.push(['Cliente', `${h.no_cliente} - ${h.cliente_nombre || ''}`])
    if (h.cliente_rnc) odRows.push(['RNC', h.cliente_rnc])
    if (h.cliente_direccion) odRows.push(['Dirección', String(h.cliente_direccion).slice(0, 80)])
  }
  if (h.vendedor) odRows.push(['Vendedor', `${h.vendedor} - ${h.vendedor_nombre || ''}`])
  if (h.ncf_dgi) odRows.push(['NCF', h.ncf_dgi])

  const refRows: Array<[string, React.ReactNode]> = []
  if (h.tipo_refe && h.no_refe) refRows.push(['Referencia', `${h.tipo_refe}-${h.no_refe}`])
  if (h.tipo_docu_devuelto && h.no_docu_devuelto) refRows.push(['Doc. devuelto', `${h.tipo_docu_devuelto}-${h.no_docu_devuelto}`])
  if (h.tipo_docu_rev && h.no_docu_rev) refRows.push(['Doc. reversado', `${h.tipo_docu_rev}-${h.no_docu_rev}`])
  if (h.no_motivo) refRows.push(['Motivo reverso', h.no_motivo])
  if (String(h.con_restock_almacen || '').toUpperCase() === 'S') refRows.push(['Restock', 'Sí'])

  const totRows: Array<[string, React.ReactNode]> = []
  const totalLinea = Number(h.total_linea) || 0
  const desc = Number(h.descuento) || 0
  const itbis = Number(h.impuesto) || 0
  const vb = Number(h.valor_bienes) || 0
  const vs = Number(h.valor_servicio) || 0
  const totalNeto = Number(h.total_neto ?? fallback?.total) || 0
  if (totalLinea) totRows.push(['Total Bruto', `RD$ ${fmt(totalLinea)}`])
  if (desc) totRows.push(['Descuento', `RD$ ${fmt(desc)}`])
  if (itbis) totRows.push(['ITBIS', `RD$ ${fmt(itbis)}`])
  if (vb) totRows.push(['Valor Bienes', `RD$ ${fmt(vb)}`])
  if (vs) totRows.push(['Valor Servicio', `RD$ ${fmt(vs)}`])
  totRows.push(['TOTAL NETO',
    <span className='text-base font-bold text-foreground'>RD$ {fmt(totalNeto)}</span>])

  return (
    <div className='grid grid-cols-2 gap-3'>
      <InfoBlock title='Documento' rows={docRows} />
      <InfoBlock title='Movimiento' rows={movRows} />
      {odRows.length > 0 && (
        <InfoBlock title='Origen / Destino' rows={odRows} span={refRows.length === 0} />
      )}
      {refRows.length > 0 && (
        <InfoBlock title='Referencias' rows={refRows} span={odRows.length === 0} />
      )}
      <InfoBlock title='Totales' rows={totRows} span />
      {(h.detalle || h.nota) && (
        <div className='col-span-2 rounded-md border bg-muted/20 px-3 py-2 text-xs space-y-1'>
          {h.detalle && (
            <div><span className='text-muted-foreground'>Detalle: </span>{h.detalle}</div>
          )}
          {h.nota && (
            <div><span className='text-muted-foreground'>Nota: </span>{h.nota}</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Líneas (columnas curadas) ────────────────────────────────────────────
const LINE_COLUMNS = [
  { key: 'no_linea', label: 'Ln', align: 'center' as const, mono: true, width: 'w-12' },
  { key: 'no_produ', label: 'Código', align: 'left' as const, mono: true, width: 'w-28' },
  { key: 'descripcion', label: 'Descripción', align: 'left' as const, width: '' },
  { key: 'unidad', label: 'Unid.', align: 'left' as const, width: 'w-16' },
  { key: 'cantidad', label: 'Cantidad', align: 'right' as const, format: 'qty', width: 'w-24' },
  { key: 'costo', label: 'Costo', align: 'right' as const, format: 'money', width: 'w-24' },
  { key: 'impuesto', label: 'ITBIS', align: 'right' as const, format: 'money', width: 'w-20' },
  { key: 'monto_neto', label: 'Monto Neto', align: 'right' as const, format: 'money', mono: true, width: 'w-28' },
]

function LineasTable({ lineas }: { lineas: Array<Record<string, any>> }) {
  if (!lineas?.length) return (
    <p className='text-sm text-muted-foreground'>No hay líneas de detalle.</p>
  )
  return (
    <div className='rounded-md border overflow-x-auto'>
      <Table>
        <TableHeader>
          <TableRow>
            {LINE_COLUMNS.map((c) => (
              <TableHead
                key={c.key}
                className={`text-[11px] ${c.width} ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}`}
              >
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lineas.map((ln, i) => (
            <TableRow key={i}>
              {LINE_COLUMNS.map((c) => {
                const raw = ln[c.key] ?? ln[c.key.toUpperCase()]
                let v: React.ReactNode = '—'
                if (raw !== undefined && raw !== null && raw !== '') {
                  if (c.format === 'money' || c.format === 'qty')
                    v = Number(raw).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  else v = String(raw)
                }
                return (
                  <TableCell
                    key={c.key}
                    className={`text-xs py-1.5 ${c.mono ? 'font-mono' : ''} ${c.align === 'right' ? 'text-right tabular-nums' : c.align === 'center' ? 'text-center' : ''}`}
                  >
                    {v}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────
export function ConsultaDocumentos() {
  const { selectedCompany } = useCompany()
  const noCia = selectedCompany || '01'
  const newHl = useDocHighlightCount('inv')
  // Deep-link desde otras pantallas (ej. "Ver entradas anteriores" en Entrada
  // de Compras) que llegan con ?tipo_docu=EC para abrir ya filtrado.
  const search = invRoute.useSearch()
  const nav = invRoute.useNavigate()

  // Tipos de entrada editables desde aquí (reusan la vista de entrada en modo
  // edición). EC va a Entrada de Compras; el resto a Entrada de Mercancía.
  const editableTipo = (t: string) =>
    ['EC', 'EA', 'EM', 'EP', 'AE'].includes((t || '').toUpperCase())
  const irAEditar = (r: Documento, e: MouseEvent) => {
    e.stopPropagation()
    const tipo = (r.tipo_docu || '').toUpperCase()
    const view = tipo === 'EC' ? 'entrada-compras' : 'entrada-mercancia'
    nav({
      search: (prev) => ({
        ...prev, section: 'procesos', view,
        edit: `${tipo}-${String(r.no_docu)}`,
      }),
    })
  }

  const today = new Date()
  const thirtyAgo = new Date(today)
  thirtyAgo.setDate(today.getDate() - 30)

  const [tipoDocu, setTipoDocu] = useState(search.tipo_docu || '__all__')
  const [tipoDocuSearch, setTipoDocuSearch] = useState('')
  const [almacen, setAlmacen] = useState('__all__')
  const [tipoMovi, setTipoMovi] = useState('__all__')
  const [desde, setDesde] = useState(toInputDate(thirtyAgo))
  const [hasta, setHasta] = useState(toInputDate(today))
  const [estado, setEstado] = useState('__all__')

  // Tipos de documento originados en FAT/CxC que NO representan un movimiento
  // "puro" de inventario. Se ocultan por defecto para que la consulta muestre
  // los movimientos de inventario (entradas/salidas/transferencias/ajustes)
  // en vez de facturas de venta.
  const NO_INV_TIPOS = ['FT', 'FC', 'CO', 'CT']

  const [tiposDocu, setTiposDocu] = useState<any[]>([])
  const [almacenes, setAlmacenes] = useState<any[]>([])
  const [rows, setRows] = useState<Documento[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [detalle, setDetalle] = useState<DocumentoDetalle | null>(null)
  const [detalleLoading, setDetalleLoading] = useState(false)
  const [detalleDoc, setDetalleDoc] = useState<Documento | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    if (!noCia) return
    apiFetch<any>(`/inv/tipos-docu/?no_cia=${noCia}`)
      .then((d) => setTiposDocu(Array.isArray(d) ? d : d.items ?? d.results ?? []))
      .catch(() => setTiposDocu([]))

    apiFetch<any>(`/inv/almacenes/?no_cia=${noCia}`)
      .then((d) => setAlmacenes(Array.isArray(d) ? d : d.items ?? d.results ?? []))
      .catch(() => setAlmacenes([]))
  }, [noCia])

  useEffect(() => {
    if (!noCia) return
    setLoading(true)
    setError('')
    const qs = new URLSearchParams({ no_cia: noCia })
    if (tipoDocu && tipoDocu !== '__all__') qs.set('tipo_docu', tipoDocu)
    if (almacen && almacen !== '__all__') qs.set('almacen', almacen)
    if (desde) qs.set('desde', desde)
    if (hasta) qs.set('hasta', hasta)
    if (estado && estado !== '__all__') qs.set('estado', estado)

    apiFetch<any>(`/inv/documentos/?${qs}`)
      .then((d) => setRows(Array.isArray(d) ? d : d.items ?? d.results ?? []))
      .catch((e) => setError(e.message ?? 'Error al cargar documentos'))
      .finally(() => setLoading(false))
  }, [noCia, tipoDocu, almacen, desde, hasta, estado])

  // Lista combinada de tipos para el dropdown: los que trae el backend de
  // TINV_TDOCU + los que aparecen en las filas cargadas + los tipos "cross-modulo"
  // conocidos (FT, FC, CO, CT — que impactan inventario aunque vivan en TFAT).
  // Sin esto el usuario no podía seleccionar FT porque el endpoint /inv/tipos-docu/
  // solo devuelve tipos del módulo INV.
  const tiposDocuMerged = useMemo(() => {
    const map = new Map<string, { tipo_docu: string; descripcion: string }>()
    // 1) los del backend (prioridad — traen la descripción real)
    for (const t of tiposDocu) {
      const code = String(t.tipo_docu ?? t.codigo ?? t.id ?? '').trim().toUpperCase()
      if (!code) continue
      map.set(code, {
        tipo_docu: code,
        descripcion: t.descripcion ?? TIPO_DOCU_FALLBACK[code] ?? '',
      })
    }
    // 2) los que aparecen en las filas ya cargadas (pueden no estar en TINV_TDOCU)
    for (const r of rows) {
      const code = String(r.tipo_docu ?? '').trim().toUpperCase()
      if (!code || map.has(code)) continue
      map.set(code, {
        tipo_docu: code,
        descripcion: r.desc_tipo_docu ?? TIPO_DOCU_FALLBACK[code] ?? '',
      })
    }
    // 3) los tipos cross-módulo conocidos (garantiza FT/FC/CO/CT siempre visibles)
    for (const code of NO_INV_TIPOS) {
      if (map.has(code)) continue
      map.set(code, { tipo_docu: code, descripcion: TIPO_DOCU_FALLBACK[code] ?? '' })
    }
    return Array.from(map.values()).sort((a, b) => a.tipo_docu.localeCompare(b.tipo_docu))
  }, [tiposDocu, rows])

  // Filtro client-side por tipo movimiento + búsqueda por código de tipo doc.
  // Si el usuario no está filtrando por tipo_docu (ni con select ni con búsqueda),
  // se ocultan por defecto los tipos de FAT/CxC (FT, FC, CO, CT) para que la
  // consulta muestre los movimientos de inventario en vez de facturas de venta.
  const filteredRows = useMemo(() => {
    const search = tipoDocuSearch.trim().toUpperCase()
    const noTipoFilter = tipoDocu === '__all__' && !search
    return rows.filter((r) => {
      const t = (r.tipo_docu || '').toUpperCase()
      if (noTipoFilter && NO_INV_TIPOS.includes(t)) return false
      if (search && !t.includes(search)) return false
      if (tipoMovi !== '__all__' && (r.tipo_movi || '').toUpperCase() !== tipoMovi) return false
      return true
    })
  }, [rows, tipoMovi, tipoDocu, tipoDocuSearch])

  function openDetalle(doc: Documento) {
    setDetalleDoc(doc)
    setDetalle(null)
    setSheetOpen(true)
    setDetalleLoading(true)
    apiFetch<any>(`/inv/documentos/${doc.tipo_docu}/${doc.no_docu}/?no_cia=${noCia}`)
      .then((d) => {
        // backend devuelve {data: {header, lines}}
        const payload = d?.data ?? d
        setDetalle(payload)
      })
      .catch(() => setDetalle({ header: {}, lines: [] }))
      .finally(() => setDetalleLoading(false))
  }

  function openPdf(doc: Documento, e: React.MouseEvent) {
    e.stopPropagation()
    const id = `${doc.tipo_docu}-${doc.no_docu}`
    const url = `/print/inv-documento/${encodeURIComponent(id)}?no_cia=${noCia}`
    window.open(url, '_blank')
  }

  const reset = () => {
    setTipoDocu('__all__')
    setTipoDocuSearch('')
    setAlmacen('__all__')
    setTipoMovi('__all__')
    setDesde(toInputDate(thirtyAgo))
    setHasta(toInputDate(today))
    setEstado('__all__')
  }

  const hasFilters =
    tipoDocu !== '__all__' || tipoDocuSearch !== '' ||
    almacen !== '__all__' ||
    tipoMovi !== '__all__' || estado !== '__all__'

  const detalleLineas = detalle?.lines ?? detalle?.lineas ?? []

  return (
    <div className='space-y-4'>
      <div>
        <h2 className='text-lg font-semibold'>Consulta de Documentos</h2>
        <p className='text-sm text-muted-foreground'>
          Buscar documentos de inventario por tipo, almacén y período. Por
          defecto se muestran movimientos de inventario (entradas, salidas,
          transferencias, ajustes). Para ver facturas (FT) escríbelo en el
          buscador de código o selecciónalo en el filtro.
        </p>
      </div>

      <KpiCards rows={filteredRows} />

      <div className='flex flex-wrap gap-2 items-end'>
        <Select value={tipoMovi} onValueChange={setTipoMovi}>
          <SelectTrigger className='h-9 w-[160px]'>
            <SelectValue placeholder='Movimiento' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='__all__'>Todos los movim.</SelectItem>
            <SelectItem value='E'>Entradas</SelectItem>
            <SelectItem value='S'>Salidas</SelectItem>
            <SelectItem value='T'>Transferencias</SelectItem>
          </SelectContent>
        </Select>

        <Select value={tipoDocu} onValueChange={setTipoDocu}>
          <SelectTrigger className='h-9 w-[220px]'>
            <SelectValue placeholder='Tipo Documento' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='__all__'>Todos los tipos</SelectItem>
            {tiposDocuMerged
              .filter((t) => {
                if (!tipoDocuSearch.trim()) return true
                const s = tipoDocuSearch.trim().toUpperCase()
                return t.tipo_docu.includes(s) || t.descripcion.toUpperCase().includes(s)
              })
              .map((t) => (
                <SelectItem key={t.tipo_docu} value={t.tipo_docu}>
                  {t.tipo_docu} — {t.descripcion || '—'}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <div className='relative'>
          <Search className='absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none' />
          <Input
            className='h-9 w-[170px] pl-7 text-sm'
            placeholder='Código tipo doc.'
            value={tipoDocuSearch}
            onChange={(e) => setTipoDocuSearch(e.target.value)}
            title='Buscar por código de tipo de documento (AE, SA, EC...)'
          />
          {tipoDocuSearch && (
            <button
              type='button'
              onClick={() => setTipoDocuSearch('')}
              className='absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted'
              aria-label='Limpiar búsqueda'
            >
              <X className='h-3 w-3' />
            </button>
          )}
        </div>

        <Select value={almacen} onValueChange={setAlmacen}>
          <SelectTrigger className='h-9 w-[180px]'>
            <SelectValue placeholder='Almacén' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='__all__'>Todos los almacenes</SelectItem>
            {almacenes.map((a: any) => {
              const key = a.almacen ?? a.codigo ?? a.id
              return (
                <SelectItem key={key} value={String(key)}>
                  {a.descripcion ?? a.descri ?? a.desc_almacen ?? key}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        <div className='flex items-center gap-1'>
          <label className='text-xs text-muted-foreground whitespace-nowrap'>Desde:</label>
          <Input
            type='date'
            className='h-9 w-[140px] text-sm'
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </div>
        <div className='flex items-center gap-1'>
          <label className='text-xs text-muted-foreground whitespace-nowrap'>Hasta:</label>
          <Input
            type='date'
            className='h-9 w-[140px] text-sm'
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>

        <Select value={estado} onValueChange={setEstado}>
          <SelectTrigger className='h-9 w-[150px]'>
            <SelectValue placeholder='Estado' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='__all__'>Todos los estados</SelectItem>
            <SelectItem value='P'>Pendiente</SelectItem>
            <SelectItem value='A'>Autorizado</SelectItem>
            <SelectItem value='N'>Anulado</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant='ghost' size='sm' className='h-9 gap-1' onClick={reset}>
            <X className='h-3.5 w-3.5' /> Limpiar
          </Button>
        )}
      </div>

      {error && (
        <div className='rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive'>
          {error}
        </div>
      )}

      <div className='rounded-md border overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-[44px]'></TableHead>
              <TableHead>Documento</TableHead>
              <TableHead className='w-[110px]'>Fecha</TableHead>
              <TableHead>Almacén</TableHead>
              <TableHead className='w-[120px] text-center'>Estado</TableHead>
              <TableHead className='w-[150px] text-right'>Total</TableHead>
              <TableHead className='w-[90px] text-center'>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>
                  Cargando...
                </TableCell>
              </TableRow>
            )}
            {!loading && filteredRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>
                  No se encontraron documentos
                </TableCell>
              </TableRow>
            )}
            {!loading && filteredRows.map((r, idx) => (
              <TableRow
                key={`${r.tipo_docu}-${r.no_docu}-${idx}`}
                className={cn(
                  'cursor-pointer hover:bg-muted/40',
                  idx < newHl && HIGHLIGHT_ROW_CLASS
                )}
                onClick={() => openDetalle(r)}
              >
                <TableCell className='text-center'>
                  <div className='inline-flex items-center justify-center'>
                    {tipoMoviIcon(r.tipo_movi)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className='flex flex-col gap-0.5 min-w-0'>
                    <div className='flex items-center gap-2'>
                      <span className={`text-[10px] font-mono font-semibold rounded px-1.5 py-0.5 border ${tipoMoviColor(r.tipo_movi)}`}>
                        {r.tipo_docu}
                      </span>
                      <span className='text-xs font-medium truncate'>
                        {tipoDocuLabel(r)}
                      </span>
                    </div>
                    <span className='font-mono text-[11px] text-muted-foreground'>
                      {r.tipo_docu}-{String(r.no_docu).padStart(7, '0')}
                    </span>
                  </div>
                </TableCell>
                <TableCell className='text-xs tabular-nums'>{fmtDate(r.fecha)}</TableCell>
                <TableCell className='text-xs'>
                  {fmtCombo(r.almacen, r.desc_almacen)}
                </TableCell>
                <TableCell className='text-center'>
                  {estadoBadge(r.estado, r.st_anulado)}
                </TableCell>
                <TableCell className='text-right font-mono text-xs font-semibold tabular-nums'>
                  RD$ {fmt(r.total)}
                </TableCell>
                <TableCell className='text-center'>
                  <div className='flex items-center justify-center gap-1'>
                    {editableTipo(r.tipo_docu) &&
                     String(r.st_anulado || 'N').toUpperCase() !== 'S' && (
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-7 w-7'
                        title='Editar documento'
                        onClick={(e) => irAEditar(r, e)}
                      >
                        <Pencil className='h-3.5 w-3.5' />
                      </Button>
                    )}
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-7 w-7'
                      title='Abrir PDF'
                      onClick={(e) => openPdf(r, e)}
                    >
                      <ExternalLink className='h-3.5 w-3.5' />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {!loading && filteredRows.length > 0 && (
        <p className='text-xs text-muted-foreground text-right'>
          {filteredRows.length} documento{filteredRows.length === 1 ? '' : 's'} mostrado{filteredRows.length === 1 ? '' : 's'}
        </p>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className='sm:max-w-[820px] w-full max-h-screen overflow-y-auto'>
          <SheetHeader>
            <SheetTitle className='flex items-center gap-2'>
              <FileText className='h-5 w-5' />
              <span className='flex items-center gap-2'>
                {detalleDoc && tipoMoviIcon(detalleDoc.tipo_movi)}
                {detalleDoc
                  ? `${tipoDocuLabel(detalleDoc)} · ${detalleDoc.tipo_docu}-${String(detalleDoc.no_docu).padStart(7, '0')}`
                  : 'Detalle de Documento'}
              </span>
            </SheetTitle>
          </SheetHeader>

          {detalleLoading && (
            <div className='py-10 text-center text-muted-foreground text-sm'>
              Cargando detalle...
            </div>
          )}

          {!detalleLoading && detalle && (
            <div className='space-y-4 mt-4'>
              <DocumentoInfoGrid
                header={detalle.header || {}}
                fallback={detalleDoc || undefined}
              />

              {detalleDoc && (
                <Button
                  variant='outline'
                  size='sm'
                  className='gap-2'
                  onClick={(e) => openPdf(detalleDoc, e)}
                >
                  <ExternalLink className='h-4 w-4' />
                  Abrir PDF
                </Button>
              )}

              <div>
                <h4 className='text-sm font-semibold mb-2'>Líneas del Documento</h4>
                <LineasTable lineas={detalleLineas} />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
