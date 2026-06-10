// FINV705 — Ajuste Conteo Físico vs. Existencia en Libro
//
// Vista única con 3 secciones (cargar / comparativo / aplicar / histórico).
// Backend correspondiente: apps/legacy/inv_views.py → /api/inv/conteo-fisico/*
//
// Flujo legado replicado:
//   1) Cargar conteo (manual o pegando filas tipo Excel)
//   2) Ver comparativo pendiente con diferencia (físico − libro)
//   3) Aplicar: genera AE/AS en TINV_MOVIMIENTO + actualiza EPRODUCTO + archiva en _H
//   4) Consultar histórico
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ClipboardList,
  Trash2,
  Upload,
  History,
  Play,
  AlertTriangle,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface Props {
  noCia: string
  punto: string
}

interface Almacen {
  almacen: string
  descripcion?: string
  ctrl_exist_min?: string
  ctrl_exist_max?: string
}

interface PendienteRow {
  no_cia: string
  punto: string
  almacen: string
  almacen_desc: string
  no_produ: string
  descripcion: string
  contador: string
  fecha: string
  conteo_fisico_uni: number
  conteo_fisico_cjs: number
  conteo_total: number
  exist_libro: number
  costo_actual: number
  diferencia: number
  valor_diferencia: number
  empaque: number
  cpe: number
}

interface HistoricoRow {
  no_cia: string
  punto: string
  almacen: string
  almacen_desc: string
  no_produ: string
  descripcion: string
  contador: string
  usuario: string
  usuario_ajusto: string
  fecha_conteo: string
  fecha_ajuste: string
  conteo_fisico_uni: number
  conteo_fisico_cjs: number
  exist_actual: number
  costo_actual: number
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  if (!res.ok)
    throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`)
  return res.json()
}

async function apiPost<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok)
    throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`)
  return res.json()
}

async function apiDel<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

const fmtN = (n?: number) =>
  Number(n ?? 0).toLocaleString('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
const fmtDate = (d?: string) =>
  d ? String(d).slice(0, 16).replace('T', ' ') : '—'

export function AjusteConteoFisico({ noCia, punto }: Props) {
  // Tabs
  const [tab, setTab] = useState<'cargar' | 'pendiente' | 'historico'>(
    'pendiente'
  )

  // Catalogos
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [almacenSel, setAlmacenSel] = useState<string>('')

  // Cargar — entrada manual
  const [manNoProdu, setManNoProdu] = useState('')
  const [manUni, setManUni] = useState<string>('')
  const [manCjs, setManCjs] = useState<string>('0')
  const [manContador, setManContador] = useState('')
  const [manAlmacen, setManAlmacen] = useState('')

  // Cargar — bulk paste (Excel-style)
  const [bulkText, setBulkText] = useState('')
  const [bulkAlmacen, setBulkAlmacen] = useState('')

  // Pendientes
  const [pendientes, setPendientes] = useState<PendienteRow[]>([])
  const [loadingPend, setLoadingPend] = useState(false)
  const [filterAlmPend, setFilterAlmPend] = useState<string>('__all__')

  // Aplicar
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [applying, setApplying] = useState(false)
  const [lastResult, setLastResult] = useState<{
    procesados: number
    entradas_generadas: number
    salidas_generadas: number
    sin_cambio: number
    errores: string[]
  } | null>(null)

  // Histórico
  const [historico, setHistorico] = useState<HistoricoRow[]>([])
  const [histCount, setHistCount] = useState(0)
  const [histPage, setHistPage] = useState(1)
  const [histDesde, setHistDesde] = useState('')
  const [histHasta, setHistHasta] = useState('')
  const [histProdu, setHistProdu] = useState('')
  const [histAlmacen, setHistAlmacen] = useState('')
  const [loadingHist, setLoadingHist] = useState(false)
  const HIST_PAGE_SIZE = 50

  // === Load almacenes ===
  useEffect(() => {
    if (!noCia) return
    apiGet<{ results: Almacen[] }>(
      `/inv/almacenes/?no_cia=${encodeURIComponent(noCia)}`
    )
      .then((d) => {
        const arr = (d.results || []).filter(
          (a: any) => (a.activo ?? 'S') !== 'N'
        )
        setAlmacenes(arr)
        if (arr.length > 0) {
          setAlmacenSel(arr[0].almacen)
          setManAlmacen(arr[0].almacen)
          setBulkAlmacen(arr[0].almacen)
        }
      })
      .catch((e) => toast.error('Error cargando almacenes: ' + e.message))
  }, [noCia])

  // === Pendientes ===
  const loadPendientes = useCallback(async () => {
    if (!noCia) return
    setLoadingPend(true)
    try {
      const qs = new URLSearchParams({ no_cia: noCia })
      if (punto) qs.set('punto', punto)
      if (filterAlmPend !== '__all__') qs.set('almacen', filterAlmPend)
      const d = await apiGet<{ results: PendienteRow[] }>(
        `/inv/conteo-fisico/pendiente/?${qs}`
      )
      setPendientes(d.results || [])
    } catch (e: any) {
      toast.error('Error cargando pendientes: ' + e.message)
    } finally {
      setLoadingPend(false)
    }
  }, [noCia, punto, filterAlmPend])

  useEffect(() => {
    loadPendientes()
  }, [loadPendientes])

  // === Histórico ===
  const loadHistorico = useCallback(
    async (page = histPage) => {
      if (!noCia) return
      setLoadingHist(true)
      try {
        const qs = new URLSearchParams({
          no_cia: noCia,
          page: String(page),
          page_size: String(HIST_PAGE_SIZE),
        })
        if (histProdu) qs.set('no_produ', histProdu)
        if (histAlmacen) qs.set('almacen', histAlmacen)
        if (histDesde) qs.set('desde', histDesde)
        if (histHasta) qs.set('hasta', histHasta)
        const d = await apiGet<{ results: HistoricoRow[]; count: number }>(
          `/inv/conteo-fisico/historico/?${qs}`
        )
        setHistorico(d.results || [])
        setHistCount(d.count || 0)
        setHistPage(page)
      } catch (e: any) {
        toast.error('Error cargando histórico: ' + e.message)
      } finally {
        setLoadingHist(false)
      }
    },
    [noCia, histPage, histProdu, histAlmacen, histDesde, histHasta]
  )

  useEffect(() => {
    if (tab === 'historico') loadHistorico(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // === Cargar manual ===
  const cargarManual = async () => {
    if (!manNoProdu || !manAlmacen) {
      toast.error('Producto y almacén son requeridos')
      return
    }
    const uni = parseFloat(manUni || '0')
    const cjs = parseFloat(manCjs || '0')
    if (!uni && !cjs) {
      toast.error('Debe ingresar conteo (unidades o cajas)')
      return
    }
    try {
      const res = await apiPost<{ inserted: number; updated: number }>(
        '/inv/conteo-fisico/cargar/',
        {
          rows: [
            {
              no_cia: noCia,
              punto: punto || '01',
              almacen: manAlmacen,
              no_produ: manNoProdu.trim().toUpperCase(),
              conteo_fisico_uni: uni,
              conteo_fisico_cjs: cjs,
              contador: manContador,
            },
          ],
        }
      )
      toast.success(
        `Guardado: ${res.inserted ? 'nuevo' : 'actualizado'} ${manNoProdu}`
      )
      setManNoProdu('')
      setManUni('')
      setManCjs('0')
      setManContador('')
      loadPendientes()
    } catch (e: any) {
      toast.error('Error al cargar: ' + e.message)
    }
  }

  // === Cargar bulk (CSV/TSV/pegado de Excel) ===
  const cargarBulk = async () => {
    const lines = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (!lines.length) {
      toast.error(
        'Pegue al menos una fila en formato: no_produ<TAB>cant_unidades<TAB>cant_cajas'
      )
      return
    }
    if (!bulkAlmacen) {
      toast.error('Seleccione almacén')
      return
    }
    const rows = lines
      .map((l) => {
        const parts = l.split(/\t|,|;/).map((p) => p.trim())
        return {
          no_cia: noCia,
          punto: punto || '01',
          almacen: bulkAlmacen,
          no_produ: (parts[0] || '').toUpperCase(),
          conteo_fisico_uni: parseFloat(parts[1] || '0') || 0,
          conteo_fisico_cjs: parseFloat(parts[2] || '0') || 0,
          contador: parts[3] || 'CARGA EXCEL',
        }
      })
      .filter((r) => r.no_produ)
    if (!rows.length) {
      toast.error('Ninguna fila válida')
      return
    }
    try {
      const res = await apiPost<{ inserted: number; updated: number }>(
        '/inv/conteo-fisico/cargar/',
        { rows }
      )
      toast.success(`${res.inserted} nuevos, ${res.updated} actualizados`)
      setBulkText('')
      loadPendientes()
      setTab('pendiente')
    } catch (e: any) {
      toast.error('Error al cargar bulk: ' + e.message)
    }
  }

  // === Descartar pendiente ===
  const descartarPend = async (row: PendienteRow) => {
    if (
      !confirm(
        `¿Descartar conteo pendiente de ${row.no_produ} en alm ${row.almacen}?`
      )
    )
      return
    try {
      await apiDel<{ deleted: number }>(
        `/inv/conteo-fisico/descartar/?no_cia=${row.no_cia}&punto=${row.punto}&almacen=${row.almacen}&no_produ=${row.no_produ}`
      )
      toast.success('Descartado')
      loadPendientes()
    } catch (e: any) {
      toast.error('Error: ' + e.message)
    }
  }

  // === Aplicar ajuste ===
  const aplicarAjuste = async () => {
    if (!pendientes.length) return
    setApplying(true)
    try {
      const res = await apiPost<typeof lastResult>(
        '/inv/conteo-fisico/aplicar/',
        {
          no_cia: noCia,
          punto: punto || '01',
          almacen: filterAlmPend !== '__all__' ? filterAlmPend : '',
        }
      )
      setLastResult(res)
      if (res && res.errores && res.errores.length > 0) {
        toast.error('Hubo errores: ' + res.errores.join('; '))
      } else {
        toast.success(
          `Aplicado: ${res?.procesados} procesados, ${res?.entradas_generadas} entradas + ${res?.salidas_generadas} salidas`
        )
      }
      setConfirmOpen(false)
      loadPendientes()
    } catch (e: any) {
      toast.error('Error al aplicar: ' + e.message)
    } finally {
      setApplying(false)
    }
  }

  // Totales pendientes
  const totals = useMemo(() => {
    return pendientes.reduce(
      (acc, r) => ({
        filas: acc.filas + 1,
        libro: acc.libro + (r.exist_libro || 0),
        fisico: acc.fisico + (r.conteo_total || 0),
        diff: acc.diff + (r.diferencia || 0),
        valorDiff: acc.valorDiff + (r.valor_diferencia || 0),
      }),
      { filas: 0, libro: 0, fisico: 0, diff: 0, valorDiff: 0 }
    )
  }, [pendientes])

  const histPages = Math.max(1, Math.ceil(histCount / HIST_PAGE_SIZE))

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='flex items-center gap-2 text-lg font-semibold'>
            <ClipboardList className='h-5 w-5 text-primary' />
            Ajuste de Conteo Físico
          </h2>
          <p className='text-sm text-muted-foreground'>
            FINV705 — carga, comparativo, ajuste y bitácora · Empresa {noCia} ·
            Punto {punto || '01'}
          </p>
        </div>
        <div className='flex gap-2'>
          {(['cargar', 'pendiente', 'historico'] as const).map((t) => (
            <Button
              key={t}
              size='sm'
              variant={tab === t ? 'default' : 'outline'}
              onClick={() => setTab(t)}
              className='capitalize'
            >
              {t === 'cargar' && <Upload className='mr-1 h-4 w-4' />}
              {t === 'pendiente' && <ClipboardList className='mr-1 h-4 w-4' />}
              {t === 'historico' && <History className='mr-1 h-4 w-4' />}
              {t === 'pendiente' && pendientes.length > 0 && (
                <Badge variant='secondary' className='ml-2'>
                  {pendientes.length}
                </Badge>
              )}
              {t}
            </Button>
          ))}
        </div>
      </div>

      {/* ============ CARGAR ============ */}
      {tab === 'cargar' && (
        <div className='space-y-4'>
          {/* Manual */}
          <div className='space-y-3 rounded-lg border bg-background p-4'>
            <h3 className='flex items-center gap-2 text-sm font-semibold tracking-wider text-gray-500 uppercase'>
              <Plus className='h-4 w-4' /> Entrada Manual (un producto)
            </h3>
            <div className='grid grid-cols-12 items-end gap-3'>
              <div className='col-span-3 space-y-1'>
                <Label>Almacén</Label>
                <Select value={manAlmacen} onValueChange={setManAlmacen}>
                  <SelectTrigger>
                    <SelectValue />
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
              <div className='col-span-3 space-y-1'>
                <Label>No. Producto</Label>
                <Input
                  value={manNoProdu}
                  onChange={(e) => setManNoProdu(e.target.value)}
                  placeholder='Ej. 00000002'
                />
              </div>
              <div className='col-span-2 space-y-1'>
                <Label>Cant. Unidades</Label>
                <Input
                  type='number'
                  value={manUni}
                  onChange={(e) => setManUni(e.target.value)}
                  step='0.001'
                />
              </div>
              <div className='col-span-2 space-y-1'>
                <Label>Cant. Cajas</Label>
                <Input
                  type='number'
                  value={manCjs}
                  onChange={(e) => setManCjs(e.target.value)}
                  step='0.001'
                />
              </div>
              <div className='col-span-2 space-y-1'>
                <Label>Contador</Label>
                <Input
                  value={manContador}
                  onChange={(e) => setManContador(e.target.value)}
                  placeholder='Nombre'
                />
              </div>
              <div className='col-span-12 flex justify-end'>
                <Button onClick={cargarManual}>
                  <Plus className='mr-1 h-4 w-4' /> Agregar a pendientes
                </Button>
              </div>
            </div>
          </div>

          {/* Bulk paste */}
          <div className='space-y-3 rounded-lg border bg-background p-4'>
            <h3 className='flex items-center gap-2 text-sm font-semibold tracking-wider text-gray-500 uppercase'>
              <Upload className='h-4 w-4' /> Carga Masiva (pegar desde Excel)
            </h3>
            <div className='flex items-end gap-3'>
              <div className='space-y-1'>
                <Label>Almacén destino</Label>
                <Select value={bulkAlmacen} onValueChange={setBulkAlmacen}>
                  <SelectTrigger className='w-72'>
                    <SelectValue />
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
              <div className='text-xs text-gray-500'>
                Formato por fila (separado por tab, coma o punto-coma):
                <br />
                <code className='bg-background px-1 font-mono'>
                  no_produ<span className='opacity-50'>\t</span>cant_unidades
                  <span className='opacity-50'>\t</span>cant_cajas
                  <span className='opacity-50'>\t</span>contador
                </code>
              </div>
            </div>
            <Textarea
              rows={10}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={'00000002\t305\t0\tJUAN\n00000003\t5544\t0\tPEDRO'}
              className='font-mono text-xs'
            />
            <div className='flex justify-end'>
              <Button onClick={cargarBulk}>
                <Upload className='mr-1 h-4 w-4' /> Cargar a pendientes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============ PENDIENTE / COMPARATIVO ============ */}
      {tab === 'pendiente' && (
        <div className='space-y-3'>
          <div className='flex flex-wrap items-end justify-between gap-3'>
            <div className='flex items-end gap-3'>
              <div className='space-y-1'>
                <Label>Filtrar almacén</Label>
                <Select value={filterAlmPend} onValueChange={setFilterAlmPend}>
                  <SelectTrigger className='w-72'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__all__'>Todos</SelectItem>
                    {almacenes.map((a) => (
                      <SelectItem key={a.almacen} value={a.almacen}>
                        {a.almacen} — {a.descripcion}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant='outline'
                size='sm'
                onClick={() => loadPendientes()}
              >
                Refrescar
              </Button>
            </div>
            <Button
              variant='destructive'
              disabled={pendientes.length === 0 || applying}
              onClick={() => setConfirmOpen(true)}
            >
              <Play className='mr-1 h-4 w-4' />
              Aplicar Ajuste ({pendientes.length})
            </Button>
          </div>

          <div className='rounded-md border bg-background'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-16'>Alm.</TableHead>
                  <TableHead className='w-28'>Producto</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className='w-28 text-right'>
                    Existencia Libro
                  </TableHead>
                  <TableHead className='w-28 text-right'>
                    Conteo Físico
                  </TableHead>
                  <TableHead className='w-28 text-right'>Diferencia</TableHead>
                  <TableHead className='w-28 text-right'>
                    Valor Dif. RD
                  </TableHead>
                  <TableHead className='w-24'>Contador</TableHead>
                  <TableHead className='w-10'></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPend && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className='py-6 text-center text-muted-foreground'
                    >
                      Cargando…
                    </TableCell>
                  </TableRow>
                )}
                {!loadingPend && pendientes.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className='py-8 text-center text-muted-foreground'
                    >
                      No hay conteos pendientes. Carga uno en la pestaña
                      "cargar".
                    </TableCell>
                  </TableRow>
                )}
                {pendientes.map((r) => {
                  const positive = r.diferencia > 0
                  const negative = r.diferencia < 0
                  return (
                    <TableRow
                      key={`${r.almacen}-${r.no_produ}`}
                      className='hover:bg-blue-50/40'
                    >
                      <TableCell className='font-mono font-semibold'>
                        {r.almacen}
                      </TableCell>
                      <TableCell className='font-mono text-sm font-semibold'>
                        {r.no_produ}
                      </TableCell>
                      <TableCell className='text-sm'>{r.descripcion}</TableCell>
                      <TableCell className='text-right font-mono text-sm'>
                        {fmtN(r.exist_libro)}
                      </TableCell>
                      <TableCell className='text-right font-mono text-sm font-semibold'>
                        {fmtN(r.conteo_total)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-sm font-bold ${positive ? 'text-green-700' : negative ? 'text-red-600' : 'text-gray-500'}`}
                      >
                        {positive ? '+' : ''}
                        {fmtN(r.diferencia)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-sm ${positive ? 'text-green-700' : negative ? 'text-red-600' : ''}`}
                      >
                        {fmtN(r.valor_diferencia)}
                      </TableCell>
                      <TableCell className='text-xs text-gray-600'>
                        {r.contador || '—'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-7 w-7 text-red-500'
                          onClick={() => descartarPend(r)}
                          title='Descartar'
                        >
                          <Trash2 className='h-3.5 w-3.5' />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {pendientes.length > 0 && (
                  <TableRow className='border-t-2 bg-muted/40 font-bold'>
                    <TableCell colSpan={3} className='text-right'>
                      Totales ({totals.filas} filas):
                    </TableCell>
                    <TableCell className='text-right font-mono'>
                      {fmtN(totals.libro)}
                    </TableCell>
                    <TableCell className='text-right font-mono'>
                      {fmtN(totals.fisico)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono ${totals.diff > 0 ? 'text-green-700' : totals.diff < 0 ? 'text-red-600' : ''}`}
                    >
                      {totals.diff > 0 ? '+' : ''}
                      {fmtN(totals.diff)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono ${totals.valorDiff > 0 ? 'text-green-700' : totals.valorDiff < 0 ? 'text-red-600' : ''}`}
                    >
                      {fmtN(totals.valorDiff)}
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {lastResult && (
            <div
              className={`rounded border p-3 text-sm ${lastResult.errores?.length ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}
            >
              <strong>Último ajuste aplicado:</strong> {lastResult.procesados}{' '}
              procesados ·{' '}
              <span className='text-green-700'>
                {lastResult.entradas_generadas} AE (entradas)
              </span>{' '}
              ·{' '}
              <span className='text-red-700'>
                {lastResult.salidas_generadas} AS (salidas)
              </span>{' '}
              · {lastResult.sin_cambio} sin cambio
              {lastResult.errores && lastResult.errores.length > 0 && (
                <div className='mt-2 text-red-700'>
                  <strong>Errores:</strong> {lastResult.errores.join('; ')}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============ HISTORICO ============ */}
      {tab === 'historico' && (
        <div className='space-y-3'>
          <div className='flex flex-wrap items-end gap-3 rounded-lg border bg-background p-3'>
            <div className='space-y-1'>
              <Label>No. Producto</Label>
              <Input
                value={histProdu}
                onChange={(e) => setHistProdu(e.target.value)}
                className='w-36 font-mono'
                placeholder='Ej. 00000002'
              />
            </div>
            <div className='space-y-1'>
              <Label>Almacén</Label>
              <Input
                value={histAlmacen}
                onChange={(e) => setHistAlmacen(e.target.value)}
                className='w-24 font-mono'
                placeholder='Ej. 06'
              />
            </div>
            <div className='space-y-1'>
              <Label>Desde</Label>
              <Input
                type='date'
                value={histDesde}
                onChange={(e) => setHistDesde(e.target.value)}
                className='w-40'
              />
            </div>
            <div className='space-y-1'>
              <Label>Hasta</Label>
              <Input
                type='date'
                value={histHasta}
                onChange={(e) => setHistHasta(e.target.value)}
                className='w-40'
              />
            </div>
            <Button size='sm' onClick={() => loadHistorico(1)}>
              Buscar
            </Button>
          </div>

          <div className='rounded-md border bg-background'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-32'>Fecha Ajuste</TableHead>
                  <TableHead className='w-14'>Alm.</TableHead>
                  <TableHead className='w-28'>Producto</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className='w-20 text-right'>Cant. Cajas</TableHead>
                  <TableHead className='w-20 text-right'>Cant. Unid.</TableHead>
                  <TableHead className='w-28 text-right'>
                    Exist. Aplicada
                  </TableHead>
                  <TableHead className='w-24'>Contador</TableHead>
                  <TableHead className='w-24'>Ajustó</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingHist && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className='py-6 text-center text-muted-foreground'
                    >
                      Cargando…
                    </TableCell>
                  </TableRow>
                )}
                {!loadingHist && historico.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className='py-8 text-center text-muted-foreground'
                    >
                      Sin registros.
                    </TableCell>
                  </TableRow>
                )}
                {historico.map((r, i) => (
                  <TableRow
                    key={`${r.no_produ}-${r.almacen}-${r.fecha_ajuste}-${i}`}
                  >
                    <TableCell className='font-mono text-xs'>
                      {fmtDate(r.fecha_ajuste)}
                    </TableCell>
                    <TableCell className='font-mono'>{r.almacen}</TableCell>
                    <TableCell className='font-mono text-sm font-semibold'>
                      {r.no_produ}
                    </TableCell>
                    <TableCell className='text-sm'>{r.descripcion}</TableCell>
                    <TableCell className='text-right font-mono text-sm'>
                      {fmtN(r.conteo_fisico_cjs)}
                    </TableCell>
                    <TableCell className='text-right font-mono text-sm'>
                      {fmtN(r.conteo_fisico_uni)}
                    </TableCell>
                    <TableCell className='text-right font-mono font-semibold'>
                      {fmtN(r.exist_actual)}
                    </TableCell>
                    <TableCell className='text-xs text-gray-600'>
                      {r.contador || '—'}
                    </TableCell>
                    <TableCell className='text-xs text-gray-600'>
                      {r.usuario_ajusto || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className='flex items-center justify-between text-sm text-gray-500'>
            <span>
              {histCount.toLocaleString()} registros · página {histPage} de{' '}
              {histPages}
            </span>
            <div className='flex gap-2'>
              <Button
                variant='outline'
                size='sm'
                disabled={histPage <= 1}
                onClick={() => loadHistorico(histPage - 1)}
              >
                Anterior
              </Button>
              <Button
                variant='outline'
                size='sm'
                disabled={histPage >= histPages}
                onClick={() => loadHistorico(histPage + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* === Confirm dialog === */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2 text-destructive'>
              <AlertTriangle className='h-5 w-5' /> Confirmar aplicación de
              ajuste
            </DialogTitle>
            <DialogDescription>
              Esta operación generará <strong>movimientos AE / AS</strong> en la
              bitácora de inventario por cada diferencia distinta de cero,
              actualizará <code>TINV_EPRODUCTO.EXIST_ACTUAL</code> con el conteo
              físico, y archivará cada fila en el histórico.{' '}
              <strong>Es irreversible.</strong>
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-1 py-2 text-sm'>
            <div>
              Filas pendientes: <strong>{pendientes.length}</strong>
            </div>
            <div>
              Diferencia neta:{' '}
              <strong
                className={
                  totals.diff > 0
                    ? 'text-green-700'
                    : totals.diff < 0
                      ? 'text-red-600'
                      : ''
                }
              >
                {totals.diff > 0 ? '+' : ''}
                {fmtN(totals.diff)} unidades
              </strong>
            </div>
            <div>
              Valor: <strong>{fmtN(totals.valorDiff)}</strong>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setConfirmOpen(false)}
              disabled={applying}
            >
              Cancelar
            </Button>
            <Button
              variant='destructive'
              onClick={aplicarAjuste}
              disabled={applying}
            >
              {applying ? 'Aplicando…' : 'Sí, aplicar ahora'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
