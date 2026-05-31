// Modal compartido de "Buscar Producto" — usado en nueva factura, nuevo conduce
// y cualquier vista que necesite seleccionar un producto con filtros de almacén,
// lista de precio y "solo con existencia".
//
// El padre maneja:
//  - cuándo abrirlo (`open`)
//  - los catálogos cargados (`almacenes`, `listas`) — se evita re-fetch por modal
//  - qué hacer al seleccionar (`onSelect(producto, cantidad, almacen)`)
//
// El modal maneja internamente:
//  - búsqueda con debounce 300ms
//  - select de almacén / lista / checkbox solo-con-existencia
//  - cantidades por producto
//  - botón "Ver movimientos" en el popover de existencia → abre MovimientosProductoModal
import { useCallback, useEffect, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { MovimientosProductoModal } from './movimientos-producto-modal'

export interface BuscarProductoModalProducto {
  no_produ: string
  descri: string
  precio: number
  porciento_impuesto: number
  unidad_empaque: string
  existencia: number
}

export interface BuscarProductoModalAlmacen { almacen: string; descripcion?: string }
export interface BuscarProductoModalLista { no_lista: number | string; descripcion?: string; nombre?: string }

interface Props {
  open: boolean
  onClose: () => void
  /** Llamado al pulsar "Agregar" o doble-clic. `almacen` es el seleccionado en el modal. */
  onSelect: (producto: BuscarProductoModalProducto, cantidad: number, almacen: string) => void
  noCia: string
  punto: string
  almacenes: BuscarProductoModalAlmacen[]
  listas: BuscarProductoModalLista[]
  /** Lista de precio por defecto (ej. la activa del documento). */
  noLista: string
  /** Almacén por defecto al abrir. */
  defaultAlmacen?: string
}

const fmtN = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const listaLabel = (l: BuscarProductoModalLista) =>
  `${l.no_lista}${l.descripcion ? ' — ' + l.descripcion : l.nombre ? ' — ' + l.nombre : ''}`

const almacenLabel = (a: BuscarProductoModalAlmacen) =>
  `${a.almacen}${a.descripcion ? ' — ' + a.descripcion : ''}`

/** Detalle de existencia por almacén — cargado on-demand al abrir el popover. */
interface ExistenciaPorAlmacen {
  almacen: string
  almacen_desc: string
  existencia: number
  costo_actual: number
  valor: number
}

export function BuscarProductoModal({
  open, onClose, onSelect,
  noCia, punto, almacenes, listas, noLista, defaultAlmacen = '',
}: Props) {
  const [search, setSearch] = useState('')
  // debouncedSearch = key efectiva para react-query. Se actualiza 300ms despues
  // del ultimo cambio de search, evitando un request por tecla.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [almacen, setAlmacen] = useState(defaultAlmacen)
  const [lista, setLista] = useState(noLista)
  const [soloExistencia, setSoloExistencia] = useState(true)

  // Cache de existencia por almacén por producto (lazy: solo carga al abrir popover).
  const [existPorProduto, setExistPorProduto] = useState<Record<string, {
    loading: boolean; rows: ExistenciaPorAlmacen[]; error?: string
  }>>({})

  // Estado para el modal de movimientos (Rinv304)
  const [moviModal, setMoviModal] = useState<{
    noProdu: string; descripcion: string; punto: string; almacen: string
  } | null>(null)

  const cargarExistenciaProducto = useCallback(async (noProdu: string) => {
    if (existPorProduto[noProdu]?.rows || existPorProduto[noProdu]?.loading) return
    setExistPorProduto(prev => ({ ...prev, [noProdu]: { loading: true, rows: [] } }))
    try {
      const res = await regalGeneralApi.invExistenciaProducto(noCia, noProdu)
      setExistPorProduto(prev => ({
        ...prev,
        [noProdu]: { loading: false, rows: (res.results || []).map(r => ({
          almacen: r.almacen,
          almacen_desc: r.almacen_desc,
          existencia: Number(r.existencia ?? 0),
          costo_actual: Number(r.costo_actual ?? 0),
          valor: Number(r.valor ?? 0),
        })) },
      }))
    } catch (e: any) {
      setExistPorProduto(prev => ({
        ...prev, [noProdu]: { loading: false, rows: [], error: e?.message ?? 'Error' },
      }))
    }
  }, [noCia, existPorProduto])

  // Cuando se abre el modal, reset estado y sincroniza defaults.
  useEffect(() => {
    if (open) {
      setSearch('')
      setDebouncedSearch('')
      setCantidades({})
      setAlmacen(defaultAlmacen)
      setLista(noLista)
      setExistPorProduto({})
    }
  }, [open, defaultAlmacen, noLista])

  // Debounce 300ms: el input actualiza `search` inmediato (UX) y este efecto
  // propaga a `debouncedSearch`, que es la key de react-query.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const almacenEfectivo = almacen && almacen !== '__all__' ? almacen : ''
  const listaEfectiva = lista || noLista

  // react-query: cache 30s entre busquedas identicas, retry 1, mantiene
  // resultados previos durante una nueva busqueda para evitar flicker.
  const productosQ = useQuery({
    queryKey: [
      'fat', 'search-productos',
      noCia, punto, listaEfectiva, debouncedSearch,
      almacenEfectivo, soloExistencia,
    ],
    queryFn: () => regalGeneralApi.fatSearchProductos(
      noCia, punto, listaEfectiva, debouncedSearch, 1, 100,
      almacenEfectivo || undefined,
      soloExistencia,
    ),
    enabled: open && !!debouncedSearch,
    staleTime: 30_000,
    retry: 1,
    placeholderData: keepPreviousData,
  })

  const results: BuscarProductoModalProducto[] = productosQ.data?.items ?? []
  const isLoading = productosQ.isFetching && !productosQ.data
  const errorMsg = productosQ.isError
    ? `No pudimos cargar los productos (la consulta tardó demasiado o el servidor respondió con un error). Verifica conexión a Oracle, reintenta o filtra con una búsqueda más específica.`
    : null

  const handleSelect = (p: BuscarProductoModalProducto) => {
    const qty = cantidades[p.no_produ] && cantidades[p.no_produ] > 0 ? cantidades[p.no_produ] : 1
    onSelect(p, qty, almacen && almacen !== '__all__' ? almacen : '')
  }

  // Almacenes en formato requerido por MovimientosProductoModal
  const almacenesParaMovi = almacenes.map(a => ({
    almacen: a.almacen,
    descripcion: a.descripcion,
  }))

  return (
    <>
    {moviModal && (
      <MovimientosProductoModal
        open={!!moviModal}
        onClose={() => setMoviModal(null)}
        noCia={noCia}
        noProdu={moviModal.noProdu}
        descripcion={moviModal.descripcion}
        almacenes={almacenesParaMovi}
        defaultPunto={moviModal.punto}
        defaultAlmacen={moviModal.almacen}
      />
    )}
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className='w-[80vw] h-[70vh] max-w-none sm:max-w-none flex flex-col p-0 gap-0 overflow-hidden'>
        <DialogHeader className='px-6 py-4 border-b shrink-0 bg-white'>
          <div className='flex items-center gap-4 flex-wrap'>
            <DialogTitle className='text-lg mr-4'>Buscar Producto</DialogTitle>

            {almacenes.length > 0 && (
              <div className='flex items-center gap-2'>
                <Label className='text-sm whitespace-nowrap text-gray-600'>Almacén:</Label>
                <Select
                  value={almacen || '__all__'}
                  onValueChange={(v) => {
                    setAlmacen(v === '__all__' ? '' : v)
                  }}
                >
                  <SelectTrigger className='h-8 w-56'><SelectValue placeholder='Todos...' /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__all__'>Todos</SelectItem>
                    {almacenes.map((a) => (
                      <SelectItem key={a.almacen} value={a.almacen}>{almacenLabel(a)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className='flex items-center gap-2'>
              <Label className='text-sm whitespace-nowrap text-gray-600'>Lista Precio:</Label>
              <Select
                value={lista}
                onValueChange={(v) => setLista(v)}
              >
                <SelectTrigger className='h-8 w-44'><SelectValue placeholder='Lista...' /></SelectTrigger>
                <SelectContent>
                  {listas.length > 0
                    ? listas.map((l) => <SelectItem key={l.no_lista} value={String(l.no_lista)}>{listaLabel(l)}</SelectItem>)
                    : <SelectItem value={noLista}>Lista {noLista}</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            <div className='flex items-center gap-2'>
              <Checkbox
                id='solo-existencia-modal'
                checked={soloExistencia}
                onCheckedChange={(v) => setSoloExistencia(v === true)}
              />
              <Label htmlFor='solo-existencia-modal' className='text-sm whitespace-nowrap text-gray-600 cursor-pointer'>
                Solo con existencia
              </Label>
            </div>
          </div>
        </DialogHeader>

        <div className='px-6 py-3 border-b shrink-0 bg-gray-50'>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Buscar por código o descripción del producto…'
            autoFocus
            className='text-base h-11'
          />
        </div>

        <div className='flex-1 overflow-y-auto px-6 py-2'>
          <Table>
            <TableHeader className='sticky top-0 bg-white z-10'>
              <TableRow>
                <TableHead className='w-32'>No. Producto</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className='w-12 text-center'>Emp</TableHead>
                <TableHead className='w-32 text-right'>Precio</TableHead>
                <TableHead className='w-16 text-right'>%ITBIS</TableHead>
                <TableHead className='w-32 text-right'>Existencia</TableHead>
                <TableHead className='w-24 text-center'>Cantidad</TableHead>
                <TableHead className='w-28 text-center'>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell><Skeleton className='h-4 w-24' /></TableCell>
                      <TableCell><Skeleton className='h-4 w-full' /></TableCell>
                      <TableCell><Skeleton className='h-4 w-10 mx-auto' /></TableCell>
                      <TableCell><Skeleton className='h-4 w-20 ml-auto' /></TableCell>
                      <TableCell><Skeleton className='h-4 w-12 ml-auto' /></TableCell>
                      <TableCell><Skeleton className='h-4 w-16 ml-auto' /></TableCell>
                      <TableCell><Skeleton className='h-7 w-20 mx-auto' /></TableCell>
                      <TableCell><Skeleton className='h-7 w-20 mx-auto' /></TableCell>
                    </TableRow>
                  ))}
                </>
              )}
              {!isLoading && errorMsg && (
                <TableRow>
                  <TableCell colSpan={8} className='py-10'>
                    <div className='max-w-md mx-auto text-center space-y-3'>
                      <p className='text-sm text-red-600 font-medium'>{errorMsg}</p>
                      <Button size='sm' variant='outline' onClick={() => productosQ.refetch()}>
                        Reintentar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !errorMsg && results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className='text-center text-gray-400 py-12 text-base'>
                    {debouncedSearch
                      ? `No se encontraron productos para "${debouncedSearch}"`
                      : 'Ingrese un término de búsqueda'}
                  </TableCell>
                </TableRow>
              )}
              {results.map((p) => (
                <TableRow
                  key={p.no_produ}
                  className='hover:bg-blue-50 cursor-pointer'
                  onDoubleClick={() => handleSelect(p)}
                >
                  <TableCell className='font-mono text-sm font-semibold'>{p.no_produ}</TableCell>
                  <TableCell className='text-sm'>{p.descri}</TableCell>
                  <TableCell className='text-center text-xs text-gray-500'>{p.unidad_empaque || '—'}</TableCell>
                  <TableCell className='text-right font-mono font-bold'>{fmtN(p.precio)}</TableCell>
                  <TableCell className='text-right text-sm'>{p.porciento_impuesto > 0 ? `${p.porciento_impuesto}%` : '—'}</TableCell>
                  <TableCell className='text-right font-mono text-sm' onClick={(e) => e.stopPropagation()}>
                    {/* Popover con desglose por almacén — carga on-demand al abrir.
                        Calculado en backend desde TINV_MOVIMIENTO (E-S), idéntico al legado. */}
                    <Popover onOpenChange={(o) => { if (o) cargarExistenciaProducto(p.no_produ) }}>
                      <PopoverTrigger asChild>
                        <button
                          type='button'
                          className={`inline-flex items-center gap-1 underline-offset-2 hover:underline ${
                            p.existencia <= 0 ? 'text-red-600 font-bold'
                            : p.existencia < 5 ? 'text-amber-600 font-semibold'
                            : 'text-green-700 font-medium'
                          }`}
                          title='Ver existencia por almacén'
                        >
                          {fmtN(p.existencia)}
                          <span className='text-[10px] text-gray-400'>▾</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align='end' className='w-80 p-0'>
                        <div className='px-3 py-2 border-b bg-gray-50'>
                          <p className='text-xs text-gray-500'>Existencia por Almacén</p>
                          <p className='text-sm font-semibold font-mono'>{p.no_produ}</p>
                          <p className='text-xs text-gray-600 truncate'>{p.descri}</p>
                        </div>
                        <div className='max-h-72 overflow-y-auto'>
                          {(() => {
                            const cell = existPorProduto[p.no_produ]
                            if (!cell || cell.loading) {
                              return <p className='text-xs text-gray-400 text-center py-6'>Cargando…</p>
                            }
                            if (cell.error) {
                              return <p className='text-xs text-red-500 text-center py-6'>{cell.error}</p>
                            }
                            const conExist = cell.rows.filter(r => r.existencia !== 0)
                            const total = cell.rows.reduce((s, r) => s + r.existencia, 0)
                            if (cell.rows.length === 0) {
                              return <p className='text-xs text-gray-400 text-center py-6'>Sin movimientos.</p>
                            }
                            return (
                              <table className='w-full text-xs'>
                                <thead className='sticky top-0 bg-white'>
                                  <tr className='text-gray-500'>
                                    <th className='text-left px-3 py-1.5 font-medium'>Almacén</th>
                                    <th className='text-right px-3 py-1.5 font-medium'>Existencia</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(conExist.length > 0 ? conExist : cell.rows).map(r => (
                                    <tr key={r.almacen} className='border-t hover:bg-blue-50'>
                                      <td className='px-3 py-1.5'>
                                        <span className='font-mono font-semibold'>{r.almacen}</span>
                                        {r.almacen_desc && <span className='ml-2 text-gray-500'>{r.almacen_desc}</span>}
                                      </td>
                                      <td className={`px-3 py-1.5 text-right font-mono ${r.existencia > 0 ? 'text-green-700 font-semibold' : 'text-gray-400'}`}>
                                        {fmtN(r.existencia)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className='border-t-2 bg-gray-50 font-bold'>
                                    <td className='px-3 py-1.5'>Total</td>
                                    <td className='px-3 py-1.5 text-right font-mono'>{fmtN(total)}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            )
                          })()}
                        </div>
                        {/* Enlace al reporte Rinv304 de movimientos */}
                        <div className='px-3 py-2 border-t bg-gray-50'>
                          <button
                            type='button'
                            className='text-xs text-blue-600 hover:text-blue-800 hover:underline w-full text-left'
                            onClick={() => setMoviModal({
                              noProdu: p.no_produ,
                              descripcion: p.descri,
                              punto: punto,
                              almacen: almacen && almacen !== '__all__' ? almacen : '',
                            })}
                          >
                            Ver movimientos (Rinv304) →
                          </button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell className='text-center' onClick={(e) => e.stopPropagation()}>
                    <Input
                      type='number' min={0.001} step='0.001'
                      value={cantidades[p.no_produ] ?? 1}
                      onChange={(e) => setCantidades(prev => ({ ...prev, [p.no_produ]: parseFloat(e.target.value) || 1 }))}
                      onClick={(e) => e.stopPropagation()}
                      className='w-20 text-center h-8 mx-auto'
                    />
                  </TableCell>
                  <TableCell className='text-center' onClick={(e) => e.stopPropagation()}>
                    <Button size='sm' className='h-8 px-4' onClick={() => handleSelect(p)}>Agregar</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className='px-6 py-3 border-t shrink-0 bg-gray-50 flex items-center justify-between text-sm text-gray-500'>
          <span>{results.length > 0 ? `${results.length} producto${results.length !== 1 ? 's' : ''} encontrado${results.length !== 1 ? 's' : ''}` : 'Sin resultados'}</span>
          <Button variant='outline' size='sm' onClick={onClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
