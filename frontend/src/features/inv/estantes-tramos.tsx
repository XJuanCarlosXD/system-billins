import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface Props { noCia: string; punto: string }

interface Almacen { no_almacen: string; descripcion: string }

interface ExistRow {
  no_produ: string
  nombre?: string
  descripcion?: string
  estante?: string
  tramo?: string
  [key: string]: any
}

interface RowEditable extends ExistRow {
  _estante: string
  _tramo: string
  _dirty: boolean
}

const ENDPOINT_EXISTE = false // cambiar a true cuando esté el backend

export function EstantesTramos({ noCia }: Props) {
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [almacen, setAlmacen] = useState('')
  const [rows, setRows] = useState<RowEditable[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!noCia) return
    fetch(`${API_BASE}/inv/almacenes/?no_cia=${encodeURIComponent(noCia)}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        setAlmacenes(Array.isArray(data) ? data : (data.results ?? []))
      })
      .catch(() => {})
  }, [noCia])

  const load = () => {
    if (!noCia || !almacen) return
    setLoading(true)
    setError(null)
    setSaveMsg(null)
    fetch(`${API_BASE}/inv/existencia/?no_cia=${encodeURIComponent(noCia)}&almacen=${encodeURIComponent(almacen)}`, {
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Error ${res.status}`)
        const data = await res.json()
        const arr: ExistRow[] = Array.isArray(data) ? data : (data.results ?? [])
        setRows(
          arr.map((r) => ({
            ...r,
            _estante: r.estante ?? '',
            _tramo: r.tramo ?? '',
            _dirty: false,
          })),
        )
      })
      .catch((err) => setError(err.message ?? 'Error al cargar existencias'))
      .finally(() => setLoading(false))
  }

  const updateCell = (idx: number, field: '_estante' | '_tramo', val: string) => {
    setRows((prev) =>
      prev.map((r, i) => i === idx ? { ...r, [field]: val, _dirty: true } : r),
    )
  }

  const guardar = async () => {
    if (!ENDPOINT_EXISTE) return
    const cambios = rows.filter((r) => r._dirty).map((r) => ({
      no_produ: r.no_produ,
      almacen,
      estante: r._estante,
      tramo: r._tramo,
    }))
    if (cambios.length === 0) return
    setSaving(true)
    setSaveMsg(null)
    setSaveError(null)
    try {
      const res = await fetch(`${API_BASE}/inv/estantes-tramos/`, {
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

  const dirtyCount = rows.filter((r) => r._dirty).length

  return (
    <TooltipProvider>
      <section className='space-y-4'>
        <div>
          <h2 className='text-lg font-semibold'>Estantes y Tramos</h2>
          <p className='text-sm text-muted-foreground'>Configuración de ubicaciones físicas en almacén (FINV117).</p>
        </div>

        {/* Filtro Almacén */}
        <div className='flex flex-wrap items-end gap-3 rounded-xl border p-4'>
          <div className='space-y-1'>
            <Label className='text-xs'>Almacén *</Label>
            <Select value={almacen} onValueChange={setAlmacen}>
              <SelectTrigger className='h-8 w-60 text-xs'>
                <SelectValue placeholder='Seleccionar almacén...' />
              </SelectTrigger>
              <SelectContent>
                {almacenes.map((a) => (
                  <SelectItem key={a.no_almacen} value={a.no_almacen}>
                    {a.no_almacen} — {a.descripcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            {rows.length} productos | {dirtyCount} cambio(s) pendiente(s)
          </div>
        )}

        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-28'>No Prod.</TableHead>
                <TableHead>Nombre Producto</TableHead>
                <TableHead className='w-36'>Estante</TableHead>
                <TableHead className='w-36'>Tramo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={4} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell>
                </TableRow>
              )}
              {!loading && rows.map((row, idx) => (
                <TableRow key={row.no_produ} className={row._dirty ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}>
                  <TableCell className='font-mono text-xs'>{row.no_produ}</TableCell>
                  <TableCell className='text-sm'>{row.nombre ?? row.descripcion ?? '—'}</TableCell>
                  <TableCell>
                    <Input
                      value={row._estante}
                      onChange={(e) => updateCell(idx, '_estante', e.target.value)}
                      className='h-7 w-28 text-xs'
                      maxLength={10}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row._tramo}
                      onChange={(e) => updateCell(idx, '_tramo', e.target.value)}
                      className='h-7 w-28 text-xs'
                      maxLength={10}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className='py-10 text-center text-muted-foreground'>
                    {almacen ? 'Sin resultados para este almacén.' : 'Seleccione un almacén y consulte.'}
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
              <TooltipContent>Endpoint en construcción — POST /api/inv/estantes-tramos/</TooltipContent>
            </Tooltip>
          )}
        </div>
      </section>
    </TooltipProvider>
  )
}
