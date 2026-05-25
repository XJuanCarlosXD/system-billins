import { useEffect, useState } from 'react'
import { Save, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

interface Props {
  noCia: string
  punto: string
}

interface FilaConteo {
  id: string
  contador: string
  no_produ: string
  nombre: string
  ubicacion: string
  emp: string
  exist_libro: number
  cf_mayor: number
  cf_unidades: number
  diferencia: number
  conteo_fisico: number // editable
}

export function ConteoFisicoManual({ noCia, punto }: Props) {
  const [almacen, setAlmacen] = useState('')
  const [noProdu, setNoProdu] = useState('')
  const [contador, setContador] = useState('')
  const [almacenes, setAlmacenes] = useState<any[]>([])

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filas, setFilas] = useState<FilaConteo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!noCia) return
    apiFetch<any>(`/inv/almacenes/?no_cia=${noCia}`)
      .then((d) => setAlmacenes(Array.isArray(d) ? d : d.items ?? d.results ?? []))
      .catch(() => {})
  }, [noCia])

  async function handleBuscar() {
    if (!almacen) { setError('El almacén es requerido.'); return }
    setError(null)
    setSaveMsg(null)
    setLoading(true)
    try {
      const qs = new URLSearchParams({ no_cia: noCia, almacen })
      if (noProdu) qs.set('no_produ', noProdu)
      if (contador) qs.set('contador', contador)
      const data = await apiFetch<any>(`/inv/conteo-fisico/?${qs}`)
      const rows: FilaConteo[] = (Array.isArray(data) ? data : data.items ?? data.results ?? []).map(
        (r: any) => ({
          id: r.id ?? `${r.no_produ}-${r.contador}`,
          contador: r.contador ?? '',
          no_produ: r.no_produ ?? '',
          nombre: r.nombre ?? r.desc_produ ?? '',
          ubicacion: r.ubicacion ?? '',
          emp: r.emp ?? '',
          exist_libro: Number(r.exist_libro ?? 0),
          cf_mayor: Number(r.cf_mayor ?? 0),
          cf_unidades: Number(r.cf_unidades ?? 0),
          diferencia: Number(r.diferencia ?? 0),
          conteo_fisico: Number(r.conteo_fisico ?? r.cf_unidades ?? 0),
        })
      )
      setFilas(rows)
    } catch {
      setError('No se pudo cargar el conteo. El endpoint puede estar en construcción.')
      setFilas([])
    } finally {
      setLoading(false)
    }
  }

  function updateConteo(id: string, value: number) {
    setFilas((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f
        const diferencia = value - f.exist_libro
        return { ...f, conteo_fisico: value, cf_unidades: value, diferencia }
      })
    )
  }

  async function handleGuardar() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch(`${API_BASE}/inv/conteo-fisico/guardar/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_cia: noCia,
          punto,
          almacen,
          filas: filas.map((f) => ({
            contador: f.contador,
            no_produ: f.no_produ,
            conteo_fisico: f.conteo_fisico,
          })),
        }),
      })
      if (res.ok) {
        setSaveMsg('Conteo guardado exitosamente.')
      } else {
        const err = await res.json().catch(() => ({}))
        setSaveMsg(`Error: ${err?.detail ?? `HTTP ${res.status}`}`)
      }
    } catch {
      setSaveMsg('Error: No se pudo conectar con el servidor. El endpoint puede estar en construcción.')
    } finally {
      setSaving(false)
    }
  }

  const totalLibro = filas.reduce((s, f) => s + f.exist_libro, 0)
  const totalFisico = filas.reduce((s, f) => s + f.conteo_fisico, 0)
  const totalDiff = filas.reduce((s, f) => s + f.diferencia, 0)

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-lg font-semibold'>Entrada de Conteo Físico Manual</h2>
        <p className='text-sm text-muted-foreground'>
          FINV707 — Captura o corrección manual del conteo físico por producto.
        </p>
      </div>

      {/* Filtros */}
      <div className='rounded-md border p-5 bg-muted/20 space-y-4'>
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
          <div className='space-y-1.5'>
            <Label>
              Almacén <span className='text-destructive'>*</span>
            </Label>
            <Select value={almacen || '__none__'} onValueChange={(v) => setAlmacen(v === '__none__' ? '' : v)}>
              <SelectTrigger className={`h-9 ${!almacen ? 'border-muted' : ''}`}>
                <SelectValue placeholder='Seleccione almacén' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='__none__' disabled>Seleccione almacén</SelectItem>
                {almacenes.map((a: any) => {
                  const key = a.almacen ?? a.codigo ?? a.id
                  return (
                    <SelectItem key={key} value={String(key)}>
                      {a.descripcion ?? a.desc_almacen ?? key}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-1.5'>
            <Label>No. Producto</Label>
            <Input
              className='h-9'
              placeholder='Opcional'
              value={noProdu}
              onChange={(e) => setNoProdu(e.target.value)}
            />
          </div>

          <div className='space-y-1.5'>
            <Label>Contador</Label>
            <Input
              className='h-9'
              placeholder='Opcional'
              value={contador}
              onChange={(e) => setContador(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <p className='text-sm text-destructive'>{error}</p>
        )}

        <Button className='gap-2' onClick={handleBuscar} disabled={loading}>
          <Search className='h-4 w-4' />
          {loading ? 'Buscando...' : 'Buscar'}
        </Button>
      </div>

      {/* Grid editable */}
      {filas.length > 0 && (
        <div className='space-y-4'>
          <div className='rounded-md border overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cont.</TableHead>
                  <TableHead>No Prod.</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Ubic.</TableHead>
                  <TableHead>Emp.</TableHead>
                  <TableHead className='text-right'>Exist. Libro</TableHead>
                  <TableHead className='text-right w-36'>Conteo Físico</TableHead>
                  <TableHead className='text-right'>Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((fila) => (
                  <TableRow key={fila.id}>
                    <TableCell>{fila.contador}</TableCell>
                    <TableCell className='font-mono text-xs'>{fila.no_produ}</TableCell>
                    <TableCell className='max-w-[180px] truncate'>{fila.nombre}</TableCell>
                    <TableCell>{fila.ubicacion}</TableCell>
                    <TableCell>{fila.emp}</TableCell>
                    <TableCell className='text-right'>{fila.exist_libro.toLocaleString()}</TableCell>
                    <TableCell className='text-right'>
                      <Input
                        type='number'
                        className='h-8 w-28 text-right ml-auto'
                        value={fila.conteo_fisico}
                        min={0}
                        onChange={(e) => updateConteo(fila.id, Number(e.target.value))}
                      />
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${fila.diferencia < 0 ? 'text-destructive' : fila.diferencia > 0 ? 'text-green-600' : ''}`}
                    >
                      {fila.diferencia.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className='font-semibold'>
                  <TableCell colSpan={5} className='text-right'>Totales:</TableCell>
                  <TableCell className='text-right'>{totalLibro.toLocaleString()}</TableCell>
                  <TableCell className='text-right'>{totalFisico.toLocaleString()}</TableCell>
                  <TableCell
                    className={`text-right ${totalDiff < 0 ? 'text-destructive' : totalDiff > 0 ? 'text-green-600' : ''}`}
                  >
                    {totalDiff.toLocaleString()}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {saveMsg && (
            <Badge variant={saveMsg.startsWith('Error') ? 'destructive' : 'outline'} className='text-xs'>
              {saveMsg}
            </Badge>
          )}

          <Button className='gap-2' onClick={handleGuardar} disabled={saving}>
            <Save className='h-4 w-4' />
            {saving ? 'Guardando...' : 'Guardar Conteo'}
          </Button>
        </div>
      )}

      {filas.length === 0 && !loading && !error && (
        <p className='text-sm text-muted-foreground'>
          Seleccione un almacén y presione Buscar para cargar el conteo.
        </p>
      )}
    </div>
  )
}
