// Modal "Movimientos del Producto" — equivalente al Rinv304 del legado.
// Muestra movimientos con balance corrido, filtros por punto/almacén/fecha,
// totales y exportación CSV.
//
// Uso:
//   <MovimientosProductoModal
//     open={open}
//     onClose={() => setOpen(false)}
//     noCia="01"
//     noProdu="00000001"
//     descripcion="FUN CEMENTO GRIS ARGOS FUNDA 1/94"
//     defaultPunto="01"
//     defaultAlmacen="01"
//   />
import { useCallback, useEffect, useState } from 'react'
import { downloadCsv } from '@/lib/csv-utils'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
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

interface MovimientoItem {
  punto: string
  almacen: string
  tipo_docu: string
  no_docu: string
  fecha: string
  entrada: number
  salida: number
  balance: number
  costo: number
  st_anulado: string
}

interface Totales {
  entradas: number
  salidas: number
  balance: number
}

export interface MovimientosProductoModalAlmacen {
  almacen: string
  descripcion?: string
}

export interface MovimientosProductoModalPunto {
  punto: string
  descripcion?: string
}

interface Props {
  open: boolean
  onClose: () => void
  noCia: string
  noProdu: string
  descripcion?: string
  /** Almacenes disponibles para el select — cargados por el padre para evitar re-fetch */
  almacenes?: MovimientosProductoModalAlmacen[]
  /** Puntos disponibles para el select */
  puntos?: MovimientosProductoModalPunto[]
  defaultPunto?: string
  defaultAlmacen?: string
}

const fmtN = (n: number) =>
  n.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 4,
  })

// Obtiene la fecha de hace 3 meses como string YYYY-MM-DD
function hace3Meses(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 3)
  return d.toISOString().slice(0, 10)
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

export function MovimientosProductoModal({
  open,
  onClose,
  noCia,
  noProdu,
  descripcion,
  almacenes = [],
  puntos = [],
  defaultPunto = '',
  defaultAlmacen = '',
}: Props) {
  const [punto, setPunto] = useState(defaultPunto)
  const [almacen, setAlmacen] = useState(defaultAlmacen)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [items, setItems] = useState<MovimientoItem[]>([])
  const [totales, setTotales] = useState<Totales>({
    entradas: 0,
    salidas: 0,
    balance: 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(
    async (p: string, alm: string, d: string, h: string) => {
      setLoading(true)
      setError(null)
      try {
        const res = await regalGeneralApi.invMovimientosProducto(
          noCia,
          noProdu,
          p,
          alm,
          d,
          h
        )
        setItems(res.items || [])
        setTotales(res.totales || { entradas: 0, salidas: 0, balance: 0 })
      } catch (e: any) {
        setError(e?.message ?? 'Error al cargar movimientos')
        setItems([])
        setTotales({ entradas: 0, salidas: 0, balance: 0 })
      } finally {
        setLoading(false)
      }
    },
    [noCia, noProdu]
  )

  // Al abrir: reset a defaults y cargar datos iniciales
  useEffect(() => {
    if (open) {
      const p = defaultPunto
      const alm = defaultAlmacen
      const d = ''
      const h = ''
      setPunto(p)
      setAlmacen(alm)
      setDesde(d)
      setHasta(h)
      setItems([])
      setTotales({ entradas: 0, salidas: 0, balance: 0 })
      setError(null)
      cargar(p, alm, d, h)
    }
  }, [open, defaultPunto, defaultAlmacen, cargar])

  const handleAplicar = () => cargar(punto, almacen, desde, hasta)

  const handleExportCsv = () => {
    const headers = [
      'Punto',
      'Almacen',
      'Tipo Doc',
      'No. Doc',
      'Fecha',
      'Entrada',
      'Salida',
      'Balance',
      'Costo',
      'Anulado',
    ]
    const rows = items.map((i) => [
      i.punto,
      i.almacen,
      i.tipo_docu,
      i.no_docu,
      i.fecha,
      i.entrada || '',
      i.salida || '',
      i.balance,
      i.costo,
      i.st_anulado,
    ])
    downloadCsv(
      `Rinv304_${noProdu}_${punto || 'todos'}_${almacen || 'todos'}.csv`,
      headers,
      rows
    )
  }

  const almacenLabel = (a: MovimientosProductoModalAlmacen) =>
    `${a.almacen}${a.descripcion ? ' — ' + a.descripcion : ''}`

  const puntoLabel = (p: MovimientosProductoModalPunto) =>
    `${p.punto}${p.descripcion ? ' — ' + p.descripcion : ''}`

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent size='picker-lg'>
        {/* Header */}
        <DialogHeader className='shrink-0 border-b bg-background px-6 py-3'>
          <DialogTitle className='text-base font-semibold'>
            Movimientos del Producto
            <span className='ml-2 font-mono text-sm text-gray-500'>
              {noProdu}
            </span>
          </DialogTitle>
          {descripcion && (
            <p className='mt-0.5 truncate text-sm text-gray-600'>
              {descripcion}
            </p>
          )}
        </DialogHeader>

        {/* Filtros */}
        <div className='shrink-0 border-b bg-background px-6 py-3'>
          <div className='flex flex-wrap items-end gap-4'>
            {puntos.length > 0 && (
              <div className='flex flex-col gap-1'>
                <Label className='text-xs text-gray-600'>Punto</Label>
                <Select
                  value={punto || '__all__'}
                  onValueChange={(v) => setPunto(v === '__all__' ? '' : v)}
                >
                  <SelectTrigger className='h-8 w-48'>
                    <SelectValue placeholder='Todos' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__all__'>Todos</SelectItem>
                    {puntos.map((p) => (
                      <SelectItem key={p.punto} value={p.punto}>
                        {puntoLabel(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {almacenes.length > 0 ? (
              <div className='flex flex-col gap-1'>
                <Label className='text-xs text-gray-600'>Almacen</Label>
                <Select
                  value={almacen || '__all__'}
                  onValueChange={(v) => setAlmacen(v === '__all__' ? '' : v)}
                >
                  <SelectTrigger className='h-8 w-56'>
                    <SelectValue placeholder='Todos' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__all__'>Todos</SelectItem>
                    {almacenes.map((a) => (
                      <SelectItem key={a.almacen} value={a.almacen}>
                        {almacenLabel(a)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className='flex flex-col gap-1'>
                <Label className='text-xs text-gray-600'>Almacen</Label>
                <Input
                  value={almacen}
                  onChange={(e) => setAlmacen(e.target.value)}
                  placeholder='Todos'
                  className='h-8 w-28'
                />
              </div>
            )}

            <div className='flex flex-col gap-1'>
              <Label className='text-xs text-gray-600'>Desde</Label>
              <Input
                type='date'
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className='h-8 w-40'
              />
            </div>

            <div className='flex flex-col gap-1'>
              <Label className='text-xs text-gray-600'>Hasta</Label>
              <Input
                type='date'
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className='h-8 w-40'
              />
            </div>

            <Button
              size='sm'
              className='h-8 px-5'
              onClick={handleAplicar}
              disabled={loading}
            >
              {loading ? 'Cargando…' : 'Aplicar'}
            </Button>

            <Button
              size='sm'
              variant='outline'
              className='h-8 px-4'
              onClick={handleExportCsv}
              disabled={items.length === 0}
            >
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Tabla */}
        <div className='flex-1 overflow-y-auto px-6 py-2'>
          {error && (
            <div className='py-6 text-center text-sm text-red-600'>{error}</div>
          )}
          {!error && (
            <Table>
              <TableHeader className='sticky top-0 z-10 bg-background shadow-sm'>
                <TableRow>
                  <TableHead className='w-14 text-center'>Pnt</TableHead>
                  <TableHead className='w-14 text-center'>Alm</TableHead>
                  <TableHead className='w-20'>Tipo Doc</TableHead>
                  <TableHead className='w-24'>No. Doc</TableHead>
                  <TableHead className='w-44'>Fecha</TableHead>
                  <TableHead className='w-28 text-right'>Entrada</TableHead>
                  <TableHead className='w-28 text-right'>Salida</TableHead>
                  <TableHead className='w-28 text-right'>Balance</TableHead>
                  <TableHead className='w-24 text-right'>Costo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className='py-12 text-center text-gray-400'
                    >
                      Cargando…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className='py-12 text-center text-gray-400'
                    >
                      Sin movimientos para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  items.map((item, idx) => (
                    <TableRow
                      key={idx}
                      className={`text-xs ${item.st_anulado === 'S' ? 'bg-red-50 text-red-700 line-through' : 'hover:bg-blue-50'}`}
                    >
                      <TableCell className='text-center font-mono'>
                        {item.punto}
                      </TableCell>
                      <TableCell className='text-center font-mono'>
                        {item.almacen}
                      </TableCell>
                      <TableCell className='font-mono font-semibold'>
                        {item.tipo_docu}
                      </TableCell>
                      <TableCell className='font-mono'>
                        {item.no_docu}
                      </TableCell>
                      <TableCell className='text-gray-600 tabular-nums'>
                        {item.fecha}
                      </TableCell>
                      <TableCell className='text-right font-mono font-semibold text-green-700'>
                        {item.entrada > 0 ? fmtN(item.entrada) : ''}
                      </TableCell>
                      <TableCell className='text-right font-mono text-red-700'>
                        {item.salida > 0 ? fmtN(item.salida) : ''}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono font-bold ${item.balance < 0 ? 'text-red-700' : 'text-gray-900'}`}
                      >
                        {fmtN(item.balance)}
                      </TableCell>
                      <TableCell className='text-right font-mono text-[11px] text-gray-500'>
                        {item.costo > 0 ? fmtN(item.costo) : ''}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Footer con totales */}
        <div className='flex shrink-0 items-center justify-between border-t bg-background px-6 py-3'>
          <div className='flex items-center gap-6 text-sm text-gray-700'>
            <span>
              {items.length} movimiento{items.length !== 1 ? 's' : ''}
            </span>
            <span>
              <span className='font-medium text-gray-500'>Entradas:</span>{' '}
              <span className='font-mono font-bold text-green-700'>
                {fmtN(totales.entradas)}
              </span>
            </span>
            <span>
              <span className='font-medium text-gray-500'>Salidas:</span>{' '}
              <span className='font-mono font-bold text-red-700'>
                {fmtN(totales.salidas)}
              </span>
            </span>
            <span>
              <span className='font-medium text-gray-500'>Balance:</span>{' '}
              <span
                className={`font-mono font-bold ${totales.balance < 0 ? 'text-red-700' : 'text-blue-700'}`}
              >
                {fmtN(totales.balance)}
              </span>
            </span>
          </div>
          <Button variant='outline' size='sm' onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
