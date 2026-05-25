import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface Props { noCia: string; punto: string }

interface Almacen { no_almacen: string; descripcion: string }

interface ProductoRow {
  no_produ: string
  nombre?: string
  descripcion?: string
  estante?: string
  tramo?: string
  costo?: number
  asignado?: boolean
  [key: string]: any
}

interface RowState extends ProductoRow {
  _checked: boolean
}

const ENDPOINT_EXISTE = false // cambiar a true cuando esté el backend

export function AsignarProductoAlmacen({ noCia, punto }: Props) {
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [almacen, setAlmacen] = useState('')
  const [rows, setRows] = useState<RowState[]>([])
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
    const params = new URLSearchParams({ no_cia: noCia, almacen })
    fetch(`${API_BASE}/inv/productos/?${params.toString()}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Error ${res.status}`)
        const data = await res.json()
        const arr: ProductoRow[] = Array.isArray(data) ? data : (data.results ?? [])
        setRows(arr.map((r) => ({ ...r, _checked: r.asignado ?? false })))
      })
      .catch((err) => setError(err.message ?? 'Error al cargar productos'))
      .finally(() => setLoading(false))
  }

  const toggleRow = (idx: number, val: boolean) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, _checked: val } : r))
  }

  const seleccionarTodos = () => {
    setRows((prev) => prev.map((r) => ({ ...r, _checked: true })))
  }

  const guardar = async () => {
    if (!ENDPOINT_EXISTE) return
    const seleccionados = rows.filter((r) => r._checked).map((r) => r.no_produ)
    setSaving(true)
    setSaveMsg(null)
    setSaveError(null)
    try {
      const res = await fetch(`${API_BASE}/inv/asignar-producto-almacen/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_cia: noCia, punto, almacen, productos: seleccionados }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail ?? `Error ${res.status}`)
      }
      setSaveMsg(`${seleccionados.length} producto(s) asignado(s) al almacén correctamente.`)
    } catch (err: any) {
      setSaveError(err.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const checkedCount = rows.filter((r) => r._checked).length

  return (
    <TooltipProvider>
      <section className='space-y-4'>
        <div>
          <h2 className='text-lg font-semibold'>Asignar Productos a Cía. y Almacén</h2>
          <p className='text-sm text-muted-foreground'>Asignación de productos a compañías y almacenes (FINV113).</p>
        </div>

        {/* Filtro Almacén */}
        <div className='flex flex-wrap items-end gap-3 rounded-xl border p-4'>
          <div className='space-y-1'>
            <Label className='text-xs'>Almacén *</Label>
            <Select value={almacen} onValueChange={setAlmacen}>
              <SelectTrigger className='h-8 w-64 text-xs'>
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
          <div className='flex items-center justify-between'>
            <span className='text-xs text-muted-foreground'>
              {rows.length} productos | {checkedCount} seleccionado(s)
            </span>
            <Button variant='outline' size='sm' onClick={seleccionarTodos}>
              Seleccionar Todos
            </Button>
          </div>
        )}

        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-12 text-center'>Asignar</TableHead>
                <TableHead className='w-28'>No Prod.</TableHead>
                <TableHead>Nombre Producto</TableHead>
                <TableHead className='w-24'>Estante</TableHead>
                <TableHead className='w-24'>Tramo</TableHead>
                <TableHead className='w-28 text-right'>Costo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell>
                </TableRow>
              )}
              {!loading && rows.map((row, idx) => (
                <TableRow
                  key={row.no_produ}
                  className={row._checked ? 'bg-blue-50 dark:bg-blue-950/20' : ''}
                  onClick={() => toggleRow(idx, !row._checked)}
                  style={{ cursor: 'pointer' }}
                >
                  <TableCell className='text-center' onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={row._checked}
                      onCheckedChange={(val) => toggleRow(idx, !!val)}
                    />
                  </TableCell>
                  <TableCell className='font-mono text-xs'>{row.no_produ}</TableCell>
                  <TableCell className='text-sm'>{row.nombre ?? row.descripcion ?? '—'}</TableCell>
                  <TableCell className='text-xs text-muted-foreground'>{row.estante ?? '—'}</TableCell>
                  <TableCell className='text-xs text-muted-foreground'>{row.tramo ?? '—'}</TableCell>
                  <TableCell className='text-right text-sm'>
                    {row.costo != null ? Number(row.costo).toFixed(4) : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>
                    {almacen ? 'Sin productos disponibles para este almacén.' : 'Seleccione un almacén y consulte.'}
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
            <Button onClick={guardar} disabled={checkedCount === 0 || saving}>
              {saving ? 'Guardando...' : `Asignar ${checkedCount > 0 ? `(${checkedCount})` : ''} al Almacén`}
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled>Asignar al Almacén</Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Endpoint en construcción — POST /api/inv/asignar-producto-almacen/</TooltipContent>
            </Tooltip>
          )}
        </div>

        <p className='text-xs text-muted-foreground'>Cía: {noCia} | Punto: {punto}</p>
      </section>
    </TooltipProvider>
  )
}
