// Consulta de Existencia en Grupo (legacy: Finv601 / Rinv602).
//
// Vista de consulta producto-por-producto con:
//   • Búsqueda por código o descripción
//   • Filtro Almacén (todos / específico)
//   • Filtro Grupo (todos / específico)
//   • Filtro Estado existencia: Con existencia / Sin existencia / Todos
//   • Tabla paginada (50 por página)
//   • Totales del lote consultado al pie
//
// Cada fila = (almacén, producto) — un mismo producto puede aparecer varias
// veces si está en varios almacenes. Coincide con el formato del legado.

import { useEffect, useMemo, useState } from 'react'
import { Layers, Search, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'
const ALL = '__all__'
const PAGE_SIZE = 50

interface Props { noCia: string; punto: string }

interface Grupo {
  grupo?: string
  grupo_produ?: string
  no_grupo?: string
  descripcion?: string
}

interface Almacen {
  almacen?: string
  no_almacen?: string
  descripcion?: string
}

interface ExistenciaRow {
  no_produ: string
  descripcion: string
  grupo_produ?: string
  grupo_descripcion?: string
  almacen: string
  almacen_desc?: string
  existencia: number
  costo_prom?: number
  valor: number
  exist_minima?: number
  exist_maxima?: number
}

const fmt = (n?: number) =>
  n == null
    ? '—'
    : Number(n).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtInt = (n?: number) =>
  n == null ? '—' : Number(n).toLocaleString('es-DO', { maximumFractionDigits: 2 })

export function ExistenciaGrupo({ noCia }: Props) {
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [grupoSel, setGrupoSel] = useState<string>(ALL)
  const [almacenSel, setAlmacenSel] = useState<string>(ALL)
  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState<'todos' | 'con' | 'sin'>('todos')
  const [loadingCat, setLoadingCat] = useState(false)
  const [rows, setRows] = useState<ExistenciaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [consulted, setConsulted] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!noCia) return
    setLoadingCat(true)
    Promise.all([
      fetch(`${API_BASE}/inv/grupos/?no_cia=${encodeURIComponent(noCia)}`, { credentials: 'include' })
        .then((r) => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)),
      fetch(`${API_BASE}/inv/almacenes/?no_cia=${encodeURIComponent(noCia)}`, { credentials: 'include' })
        .then((r) => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)),
    ])
      .then(([gData, aData]) => {
        setGrupos(Array.isArray(gData) ? gData : (gData.results ?? []))
        setAlmacenes(Array.isArray(aData) ? aData : (aData.results ?? []))
      })
      .catch(() => toast.error('No se pudieron cargar catálogos'))
      .finally(() => setLoadingCat(false))
  }, [noCia])

  const grupoLabel = (g: Grupo) => {
    const code = g.grupo_produ ?? g.grupo ?? g.no_grupo ?? ''
    const desc = g.descripcion ?? ''
    return desc ? `${code} — ${desc}` : code
  }

  const almacenLabel = (a: Almacen) => {
    const code = a.almacen ?? a.no_almacen ?? ''
    const desc = a.descripcion ?? ''
    return desc ? `${code} — ${desc}` : code
  }

  const consultar = () => {
    setLoading(true)
    setConsulted(true)
    setPage(1)
    const qs = new URLSearchParams({ no_cia: noCia })
    if (grupoSel !== ALL) qs.set('grupo', grupoSel)
    if (almacenSel !== ALL) qs.set('almacen', almacenSel)
    if (search.trim()) qs.set('search', search.trim())
    if (estado === 'con') qs.set('solo_con_existencia', '1')

    fetch(`${API_BASE}/inv/existencia/?${qs.toString()}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((data) => {
        let items: ExistenciaRow[] = Array.isArray(data) ? data : (data.results ?? data.items ?? [])
        // El backend acepta solo_con_existencia, pero "sin existencia" lo
        // filtramos en frontend para no agregar otro param.
        if (estado === 'sin') {
          items = items.filter((r) => Number(r.existencia || 0) <= 0)
        }
        setRows(items)
      })
      .catch((e) => {
        toast.error('Error al cargar existencias: ' + (e?.message ?? e))
        setRows([])
      })
      .finally(() => setLoading(false))
  }

  const limpiar = () => {
    setSearch('')
    setGrupoSel(ALL)
    setAlmacenSel(ALL)
    setEstado('todos')
    setRows([])
    setConsulted(false)
    setPage(1)
  }

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return rows.slice(start, start + PAGE_SIZE)
  }, [rows, page])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const totalExistencia = useMemo(
    () => rows.reduce((acc, r) => acc + Number(r.existencia || 0), 0),
    [rows],
  )
  const totalValor = useMemo(
    () => rows.reduce((acc, r) => acc + Number(r.valor || 0), 0),
    [rows],
  )

  return (
    <section className='space-y-4'>
      <div>
        <h2 className='text-lg font-semibold flex items-center gap-2'>
          <Layers className='h-5 w-5 text-primary' />
          Existencia en Grupo
        </h2>
        <p className='text-sm text-muted-foreground'>
          Consulta producto por producto. Filtra por almacén, grupo, código o descripción.
        </p>
      </div>

      {/* Filtros */}
      <div className='rounded-lg border bg-muted/30 p-3 space-y-3'>
        <div className='flex flex-wrap items-end gap-3'>
          <div className='space-y-1 flex-1 min-w-[260px]'>
            <Label className='text-xs'>Buscar</Label>
            <div className='relative'>
              <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && consultar()}
                placeholder='Código o descripción del producto…'
                className='h-9 pl-8'
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className='absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                  aria-label='Limpiar búsqueda'
                >
                  <X className='h-3.5 w-3.5' />
                </button>
              )}
            </div>
          </div>

          <div className='space-y-1'>
            <Label className='text-xs'>Almacén</Label>
            <Select value={almacenSel} onValueChange={setAlmacenSel} disabled={loadingCat}>
              <SelectTrigger className='h-9 w-[200px]'>
                <SelectValue placeholder='Todos' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos los almacenes</SelectItem>
                {almacenes.map((a) => {
                  const code = a.almacen ?? a.no_almacen ?? ''
                  return <SelectItem key={code} value={code}>{almacenLabel(a)}</SelectItem>
                })}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-1'>
            <Label className='text-xs'>Grupo</Label>
            <Select value={grupoSel} onValueChange={setGrupoSel} disabled={loadingCat}>
              <SelectTrigger className='h-9 w-[220px]'>
                <SelectValue placeholder='Todos' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos los grupos</SelectItem>
                {grupos.map((g) => {
                  const code = g.grupo_produ ?? g.grupo ?? g.no_grupo ?? ''
                  return <SelectItem key={code} value={code}>{grupoLabel(g)}</SelectItem>
                })}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-1'>
            <Label className='text-xs'>Existencia</Label>
            <Select value={estado} onValueChange={(v) => setEstado(v as any)}>
              <SelectTrigger className='h-9 w-[160px]'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='todos'>Todos</SelectItem>
                <SelectItem value='con'>Con existencia</SelectItem>
                <SelectItem value='sin'>Sin existencia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={consultar} disabled={loading || loadingCat} className='gap-2 h-9'>
            {loading ? <Loader2 className='h-4 w-4 animate-spin' /> : <Search className='h-4 w-4' />}
            Consultar
          </Button>
          <Button onClick={limpiar} variant='ghost' size='sm' className='h-9'>
            Limpiar
          </Button>
        </div>
      </div>

      {/* Resumen */}
      {consulted && !loading && (
        <div className='flex flex-wrap gap-3 text-sm'>
          <Badge variant='outline' className='gap-1'>
            <span className='text-muted-foreground'>Filas:</span>
            <span className='font-mono font-semibold'>{rows.length.toLocaleString('es-DO')}</span>
          </Badge>
          <Badge variant='outline' className='gap-1'>
            <span className='text-muted-foreground'>Existencia total:</span>
            <span className='font-mono font-semibold'>{fmt(totalExistencia)}</span>
          </Badge>
          <Badge variant='outline' className='gap-1'>
            <span className='text-muted-foreground'>Valor total:</span>
            <span className='font-mono font-semibold'>RD$ {fmt(totalValor)}</span>
          </Badge>
        </div>
      )}

      {/* Tabla */}
      {consulted ? (
        <div className='rounded-md border overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-[110px]'>Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className='w-[140px]'>Grupo</TableHead>
                <TableHead className='w-[130px]'>Almacén</TableHead>
                <TableHead className='text-right w-[120px]'>Existencia</TableHead>
                <TableHead className='text-right w-[110px]'>Costo prom.</TableHead>
                <TableHead className='text-right w-[140px]'>Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>
                    <Loader2 className='h-5 w-5 animate-spin mx-auto mb-2' />
                    Cargando…
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>
                    No se encontraron productos con los filtros seleccionados.
                  </TableCell>
                </TableRow>
              )}
              {!loading && pagedRows.map((r, idx) => {
                const ex = Number(r.existencia || 0)
                const sinStock = ex <= 0
                return (
                  <TableRow key={`${r.no_produ}-${r.almacen}-${idx}`}>
                    <TableCell className='font-mono text-xs'>{r.no_produ}</TableCell>
                    <TableCell className='text-sm'>{r.descripcion}</TableCell>
                    <TableCell className='text-xs'>
                      <span className='font-mono'>{r.grupo_produ ?? '—'}</span>
                      {r.grupo_descripcion && (
                        <span className='text-muted-foreground ml-1'>· {r.grupo_descripcion}</span>
                      )}
                    </TableCell>
                    <TableCell className='text-xs'>
                      <span className='font-mono'>{r.almacen}</span>
                      {r.almacen_desc && (
                        <span className='text-muted-foreground ml-1'>· {r.almacen_desc}</span>
                      )}
                    </TableCell>
                    <TableCell className={`text-right font-mono tabular-nums ${sinStock ? 'text-muted-foreground' : 'font-semibold'}`}>
                      {fmtInt(ex)}
                    </TableCell>
                    <TableCell className='text-right font-mono tabular-nums text-xs'>
                      {fmt(r.costo_prom)}
                    </TableCell>
                    <TableCell className='text-right font-mono tabular-nums'>
                      {fmt(r.valor)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            {!loading && rows.length > 0 && (
              <TableFooter>
                <TableRow className='font-semibold bg-muted/50'>
                  <TableCell colSpan={4} className='text-right text-xs'>Totales (todas las filas):</TableCell>
                  <TableCell className='text-right font-mono tabular-nums'>{fmt(totalExistencia)}</TableCell>
                  <TableCell />
                  <TableCell className='text-right font-mono tabular-nums'>{fmt(totalValor)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      ) : (
        <div className='rounded-md border-2 border-dashed p-12 text-center text-muted-foreground'>
          <Layers className='h-8 w-8 mx-auto mb-3 opacity-30' />
          <p className='text-sm'>Ingresa filtros y haz clic en <b>Consultar</b>.</p>
        </div>
      )}

      {/* Paginación */}
      {consulted && rows.length > 0 && (
        <div className='flex items-center justify-between gap-2 text-sm'>
          <span className='text-muted-foreground'>
            Página {page} de {totalPages} · {Math.min(PAGE_SIZE, rows.length - (page - 1) * PAGE_SIZE)} de {rows.length} filas
          </span>
          <div className='flex gap-2'>
            <Button variant='outline' size='sm' disabled={page === 1} onClick={() => setPage(1)}>
              «
            </Button>
            <Button variant='outline' size='sm' disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button variant='outline' size='sm' disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Siguiente
            </Button>
            <Button variant='outline' size='sm' disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
              »
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
