import { useEffect, useState } from 'react'
import { Layers, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface Props { noCia: string; punto: string }

interface Grupo {
  grupo?: string
  no_grupo?: string
  descripcion?: string
  [key: string]: any
}

interface Almacen {
  almacen?: string
  no_almacen?: string
  descripcion?: string
  [key: string]: any
}

interface ExistenciaRow {
  grupo?: string
  no_grupo?: string
  nombre_grupo?: string
  descripcion?: string
  almacen?: string
  total_productos?: number
  existencia_total?: number
  valor_total?: number
  [key: string]: any
}

interface GroupedRow {
  grupo: string
  nombre_grupo: string
  almacen: string
  total_productos: number
  existencia_total: number
  valor_total: number
}

function fmt(n?: number) {
  return n == null
    ? '—'
    : n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtInt(n?: number) {
  return n == null ? '—' : String(n)
}

// Sentinel para "Todos" — Radix Select prohíbe value='' (rompe la página).
const ALL = '__all__'

export function ExistenciaGrupo({ noCia }: Props) {
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [grupoSel, setGrupoSel] = useState<string>(ALL)
  const [almacenSel, setAlmacenSel] = useState<string>(ALL)
  const [loadingCat, setLoadingCat] = useState(false)
  const [rows, setRows] = useState<GroupedRow[]>([])
  const [loading, setLoading] = useState(false)
  const [consulted, setConsulted] = useState(false)

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

  const handleConsultar = () => {
    setLoading(true)
    setConsulted(true)
    const qs = new URLSearchParams({ no_cia: noCia })
    if (grupoSel && grupoSel !== ALL) qs.set('grupo', grupoSel)
    if (almacenSel && almacenSel !== ALL) qs.set('almacen', almacenSel)

    fetch(`${API_BASE}/inv/existencia/?${qs.toString()}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((data) => {
        const items: ExistenciaRow[] = Array.isArray(data) ? data : (data.results ?? data.items ?? [])

        // Aggregate by grupo + almacen in frontend. El backend ya devuelve
        // grupo_produ y grupo_descripcion (y filtra por grupo si está seleccionado).
        const map = new Map<string, GroupedRow>()
        for (const item of items) {
          const g = item.grupo_produ ?? item.grupo ?? item.no_grupo ?? '—'
          const a = item.almacen ?? '—'
          const key = `${g}||${a}`
          const desc = item.grupo_descripcion ?? item.nombre_grupo ?? item.descripcion ?? g
          if (!map.has(key)) {
            map.set(key, { grupo: g, nombre_grupo: desc, almacen: a, total_productos: 0, existencia_total: 0, valor_total: 0 })
          }
          const row = map.get(key)!
          row.total_productos += 1
          row.existencia_total += Number(item.existencia ?? item.existencia_total ?? 0)
          row.valor_total += Number(item.valor ?? item.valor_total ?? 0)
        }
        setRows(Array.from(map.values()))
      })
      .catch((e) => {
        toast.error('Error al cargar existencias: ' + (e?.message ?? e))
        setRows([])
      })
      .finally(() => setLoading(false))
  }

  const totalExistencia = rows.reduce((acc, r) => acc + r.existencia_total, 0)
  const totalValor = rows.reduce((acc, r) => acc + r.valor_total, 0)

  return (
    <section className='space-y-6'>
      <div>
        <h2 className='text-lg font-semibold flex items-center gap-2'>
          <Layers className='h-5 w-5 text-primary' />
          Existencia en Grupo
        </h2>
        <p className='text-sm text-muted-foreground'>Consulta de existencias agrupadas por grupo de productos</p>
      </div>

      {/* Filtros */}
      <div className='flex flex-wrap items-end gap-4'>
        <div className='space-y-1'>
          <Label htmlFor='grupo-sel'>Grupo Producto</Label>
          <Select value={grupoSel} onValueChange={setGrupoSel} disabled={loadingCat}>
            <SelectTrigger id='grupo-sel' className='h-9 w-[260px]'>
              <SelectValue placeholder={loadingCat ? 'Cargando...' : 'Todos los grupos'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los grupos</SelectItem>
              {grupos.map((g) => {
                const code = g.grupo_produ ?? g.grupo ?? g.no_grupo ?? ''
                return (
                  <SelectItem key={code} value={code}>
                    {grupoLabel(g)}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-1'>
          <Label htmlFor='almacen-sel'>Almacén</Label>
          <Select value={almacenSel} onValueChange={setAlmacenSel} disabled={loadingCat}>
            <SelectTrigger id='almacen-sel' className='h-9 w-[260px]'>
              <SelectValue placeholder={loadingCat ? 'Cargando...' : 'Todos los almacenes'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los almacenes</SelectItem>
              {almacenes.map((a) => {
                const code = a.almacen ?? a.no_almacen ?? ''
                return (
                  <SelectItem key={code} value={code}>
                    {almacenLabel(a)}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleConsultar} disabled={loading} className='gap-2 h-9'>
          <Search className='h-4 w-4' />
          {loading ? 'Consultando...' : 'Consultar'}
        </Button>
      </div>

      {/* Tabla */}
      {consulted && (
        <div className='rounded-md border overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-[100px]'>Grupo</TableHead>
                <TableHead>Nombre Grupo</TableHead>
                <TableHead className='w-[100px]'>Almacén</TableHead>
                <TableHead className='text-right'>Total Productos</TableHead>
                <TableHead className='text-right'>Existencia Total</TableHead>
                <TableHead className='text-right'>Valor Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>
                    Cargando...
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>
                    Sin datos para los filtros seleccionados
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.map((r, idx) => (
                <TableRow key={idx}>
                  <TableCell className='font-mono text-xs font-medium'>{r.grupo}</TableCell>
                  <TableCell className='text-sm'>{r.nombre_grupo}</TableCell>
                  <TableCell className='font-mono text-xs'>{r.almacen}</TableCell>
                  <TableCell className='text-right font-mono text-sm'>{fmtInt(r.total_productos)}</TableCell>
                  <TableCell className='text-right font-mono text-sm'>{fmt(r.existencia_total)}</TableCell>
                  <TableCell className='text-right font-mono text-sm font-medium'>{fmt(r.valor_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            {!loading && rows.length > 0 && (
              <TableFooter>
                <TableRow className='font-semibold bg-muted/50'>
                  <TableCell colSpan={4} className='text-right text-xs'>Totales:</TableCell>
                  <TableCell className='text-right font-mono'>{fmt(totalExistencia)}</TableCell>
                  <TableCell className='text-right font-mono'>{fmt(totalValor)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      )}

      {!consulted && (
        <div className='rounded-md border-2 border-dashed p-12 text-center text-muted-foreground'>
          <Layers className='h-8 w-8 mx-auto mb-3 opacity-30' />
          <p className='text-sm'>Seleccione los filtros y haga clic en Consultar</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <p className='text-xs text-muted-foreground text-right'>{rows.length} grupo(s) encontrado(s)</p>
      )}
    </section>
  )
}
