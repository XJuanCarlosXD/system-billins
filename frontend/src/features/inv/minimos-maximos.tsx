import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface Props { noCia: string; punto: string }

// Nombres de campo reales de los endpoints /api/inv/ (verificado 2026-07-02):
// almacenes → almacen, grupos → grupo_produ, lineas → linea
interface Almacen { almacen: string; descripcion: string }
interface Grupo { grupo_produ: string; descripcion: string }
interface Linea { linea: string; descripcion: string }

interface ExistRow {
  no_produ: string
  nombre: string
  cpe?: number
  existencia?: number
  existencia_minima?: number
  existencia_maxima?: number
  [key: string]: any
}

interface RowEditable extends ExistRow {
  _min: string
  _max: string
  _dirty: boolean
}

type FiltroExist = 'todos' | 'con-existencia' | 'bajo-minimo' | 'sobre-maximo'

const ENDPOINT_EXISTE = false // cambiar a true cuando esté el backend

async function fetchCatalog<T>(url: string): Promise<T[]> {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : (data.results ?? [])
}

function applyFiltro(rows: RowEditable[], filtro: FiltroExist): RowEditable[] {
  switch (filtro) {
    case 'con-existencia':
      return rows.filter((r) => (r.existencia ?? 0) > 0)
    case 'bajo-minimo':
      return rows.filter((r) => {
        const min = parseFloat(r._min) || (r.existencia_minima ?? 0)
        return (r.existencia ?? 0) < min
      })
    case 'sobre-maximo':
      return rows.filter((r) => {
        const max = parseFloat(r._max) || (r.existencia_maxima ?? 0)
        return max > 0 && (r.existencia ?? 0) > max
      })
    default:
      return rows
  }
}

export function MinimosMaximos({ noCia }: Props) {
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [lineas, setLineas] = useState<Linea[]>([])
  const [almacen, setAlmacen] = useState('')
  const [grupo, setGrupo] = useState('')
  const [linea, setLinea] = useState('')
  const [filtro, setFiltro] = useState<FiltroExist>('todos')
  const [rows, setRows] = useState<RowEditable[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!noCia) return
    fetchCatalog<Almacen>(`${API_BASE}/inv/almacenes/?no_cia=${encodeURIComponent(noCia)}`).then(setAlmacenes)
    fetchCatalog<Grupo>(`${API_BASE}/inv/grupos/?no_cia=${encodeURIComponent(noCia)}`).then(setGrupos)
    fetchCatalog<Linea>(`${API_BASE}/inv/lineas/?no_cia=${encodeURIComponent(noCia)}`).then(setLineas)
  }, [noCia])

  const load = () => {
    if (!noCia || !almacen) return
    setLoading(true)
    setError(null)
    setSaveMsg(null)
    const params = new URLSearchParams({ no_cia: noCia, almacen })
    if (grupo) params.set('grupo', grupo)
    if (linea) params.set('linea', linea)
    fetch(`${API_BASE}/inv/existencia/?${params.toString()}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Error ${res.status}`)
        const data = await res.json()
        const arr: ExistRow[] = Array.isArray(data) ? data : (data.results ?? [])
        setRows(
          arr.map((r) => ({
            ...r,
            _min: String(r.existencia_minima ?? ''),
            _max: String(r.existencia_maxima ?? ''),
            _dirty: false,
          })),
        )
      })
      .catch((err) => setError(err.message ?? 'Error al cargar existencias'))
      .finally(() => setLoading(false))
  }

  const updateCell = (idx: number, field: '_min' | '_max', val: string) => {
    setRows((prev) =>
      prev.map((r, i) => i === idx ? { ...r, [field]: val, _dirty: true } : r),
    )
  }

  const guardar = async () => {
    if (!ENDPOINT_EXISTE) return
    const cambios = rows.filter((r) => r._dirty).map((r) => ({
      no_produ: r.no_produ,
      almacen,
      existencia_minima: parseFloat(r._min) || 0,
      existencia_maxima: parseFloat(r._max) || 0,
    }))
    if (cambios.length === 0) return
    setSaving(true)
    setSaveMsg(null)
    setSaveError(null)
    try {
      const res = await fetch(`${API_BASE}/inv/minimos-maximos/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_cia: noCia, cambios }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail ?? `Error ${res.status}`)
      }
      setSaveMsg(`${cambios.length} producto(s) actualizado(s) correctamente.`)
      setRows((prev) => prev.map((r) => ({ ...r, _dirty: false })))
    } catch (err: any) {
      setSaveError(err.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const filtered = useMemo(() => applyFiltro(rows, filtro), [rows, filtro])
  const dirtyCount = rows.filter((r) => r._dirty).length

  return (
    <TooltipProvider>
      <section className='space-y-4'>
        <div>
          <h2 className='text-lg font-semibold'>Mínimo y Máximo</h2>
          <p className='text-sm text-muted-foreground'>Control de niveles mínimos y máximos de inventario (FINV116).</p>
        </div>

        {/* Filtros */}
        <div className='rounded-xl border p-4 space-y-4'>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
            <div className='space-y-1'>
              <Label className='text-xs'>Almacén *</Label>
              <Select value={almacen} onValueChange={setAlmacen}>
                <SelectTrigger className='h-8 text-xs'>
                  <SelectValue placeholder='Seleccionar...' />
                </SelectTrigger>
                <SelectContent>
                  {almacenes.map((a) => (
                    <SelectItem key={a.almacen} value={a.almacen}>
                      {a.almacen} — {a.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>Grupo</Label>
              <Select value={grupo || '__todos__'} onValueChange={(v) => setGrupo(v === '__todos__' ? '' : v)}>
                <SelectTrigger className='h-8 text-xs'>
                  <SelectValue placeholder='Todos' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__todos__'>Todos</SelectItem>
                  {grupos.map((g) => (
                    <SelectItem key={g.grupo_produ} value={g.grupo_produ}>
                      {g.grupo_produ} — {g.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>Línea</Label>
              <Select value={linea || '__todas__'} onValueChange={(v) => setLinea(v === '__todas__' ? '' : v)}>
                <SelectTrigger className='h-8 text-xs'>
                  <SelectValue placeholder='Todas' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__todas__'>Todas</SelectItem>
                  {lineas.map((l) => (
                    <SelectItem key={l.linea} value={l.linea}>
                      {l.linea} — {l.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className='space-y-1'>
            <Label className='text-xs'>Mostrar productos:</Label>
            <RadioGroup value={filtro} onValueChange={(v) => setFiltro(v as FiltroExist)} className='flex flex-wrap gap-4'>
              {[
                { value: 'todos', label: 'Todos' },
                { value: 'con-existencia', label: 'Con Existencia' },
                { value: 'bajo-minimo', label: 'Menor que el Mínimo' },
                { value: 'sobre-maximo', label: 'Mayor que el Máximo' },
              ].map(({ value, label }) => (
                <div key={value} className='flex items-center gap-1.5'>
                  <RadioGroupItem value={value} id={`filtro-${value}`} />
                  <Label htmlFor={`filtro-${value}`} className='font-normal text-xs cursor-pointer'>{label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <Button size='sm' disabled={!almacen || loading} onClick={load}>
            {loading ? 'Cargando...' : 'Consultar'}
          </Button>
        </div>

        {error && (
          <div className='rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400'>
            {error}
          </div>
        )}

        {rows.length > 0 && (
          <div className='text-xs text-muted-foreground'>
            Mostrando {filtered.length} de {rows.length} productos | {dirtyCount} cambio(s) pendiente(s)
          </div>
        )}

        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-28'>No Prod.</TableHead>
                <TableHead>Nombre Producto</TableHead>
                <TableHead className='w-20 text-right'>CPE</TableHead>
                <TableHead className='w-28 text-right'>Exist. Actual</TableHead>
                <TableHead className='w-32'>Exist. Mín.</TableHead>
                <TableHead className='w-32'>Exist. Máx.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell>
                </TableRow>
              )}
              {!loading && filtered.map((row) => {
                const realIdx = rows.indexOf(row)
                return (
                  <TableRow key={row.no_produ} className={row._dirty ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}>
                    <TableCell className='font-mono text-xs'>{row.no_produ}</TableCell>
                    <TableCell className='text-sm'>{row.nombre ?? row.descripcion}</TableCell>
                    <TableCell className='text-right text-sm'>{row.cpe ?? '—'}</TableCell>
                    <TableCell className='text-right text-sm font-medium'>{row.existencia ?? 0}</TableCell>
                    <TableCell>
                      <Input
                        type='number'
                        min='0'
                        step='1'
                        value={row._min}
                        onChange={(e) => updateCell(realIdx, '_min', e.target.value)}
                        className='h-7 w-24 text-xs'
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type='number'
                        min='0'
                        step='1'
                        value={row._max}
                        onChange={(e) => updateCell(realIdx, '_max', e.target.value)}
                        className='h-7 w-24 text-xs'
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>
                    {almacen ? 'Sin resultados. Ajuste los filtros y consulte.' : 'Seleccione un almacén y consulte.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {saveMsg && (
          <div className='rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400'>
            {saveMsg}
          </div>
        )}
        {saveError && <p className='text-sm text-red-500'>{saveError}</p>}

        <div>
          {ENDPOINT_EXISTE ? (
            <Button onClick={guardar} disabled={dirtyCount === 0 || saving}>
              {saving ? 'Guardando...' : `Guardar ${dirtyCount > 0 ? `(${dirtyCount})` : ''}`}
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled>Guardar Cambios</Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Endpoint en construcción — POST /api/inv/minimos-maximos/</TooltipContent>
            </Tooltip>
          )}
        </div>
      </section>
    </TooltipProvider>
  )
}
