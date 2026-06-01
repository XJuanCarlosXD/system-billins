import { useEffect, useState } from 'react'
import {
  AlertCircle, CheckCircle2, Clock, FileSpreadsheet,
  Printer, RefreshCw, Search, XCircle, ChevronLeft, ChevronRight, Eye, AlertTriangle, FileText,
} from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { buildReportMeta, downloadCsv, fmtN, printFacturas } from './fat-export'

interface Props { noCia: string; punto: string; mes: number; ano: number }

type Factura = {
  no_cia: string; punto: string; tipo_factura: string; no_factura: string
  no_cliente: number; nombre_cliente: string; fecha: string | null
  vendedor: string; total_linea: number; descuento: number
  impuesto: number; total_neto: number; estado: string
  ncf: number | null; posiciones_fijas_ncf?: string; ncf_dgi?: string
  codigo_ncf: string; tipo_ncf_fiscal: string
  plazo_pago: number; forma_pago: string; st_anulado: string; st_impresion: string
}

type FacturaDetalle = Factura & {
  propina: number; tasa_us: number; porc_impuesto: number
  nota: string; detalle: string; no_condicion_pago: string
  st_generado_cnt: string
  lineas: Array<{
    no_linea: number; no_produ: string; descripcion: string
    cantidad: number; precio: number; porc_descuento: number
    descuento: number; porciento_impuesto: number; impuesto: number
    monto_neto: number; cantidad_regalia: number; st_anulado: string
  }>
}

// Estado de factura SIGAF: P=Pendiente, A=Autorizada, C=Cerrada (impresa /
// finalizada). La anulacion se rastrea por st_anulado='S' aparte; C NO
// significa anulada — eso era un error de mapeo.
const ESTADO_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  A: { label: 'Autorizada', variant: 'default' },
  P: { label: 'Pendiente',  variant: 'secondary' },
  C: { label: 'Cerrada',    variant: 'outline' },
}

const ESTADO_ICON: Record<string, typeof CheckCircle2> = {
  A: CheckCircle2, P: Clock, C: CheckCircle2,
}

export function Facturas({ noCia, punto, mes, ano }: Props) {
  const [rows, setRows] = useState<Factura[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [filterDesde, setFilterDesde] = useState('')
  const [filterHasta, setFilterHasta] = useState('')

  const [selected, setSelected] = useState<FacturaDetalle | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Anulación state
  const [anularOpen, setAnularOpen] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [anulando, setAnulando] = useState(false)
  const [anularError, setAnularError] = useState('')

  const PAGE_SIZE = 30

  const load = (p = page) => {
    setLoading(true)
    regalGeneralApi.fatListFacturas({
      no_cia: noCia, punto, page: p, page_size: PAGE_SIZE,
      search, tipo: filterTipo, estado: filterEstado,
      desde: filterDesde, hasta: filterHasta,
    })
      .then((d) => {
        setRows(d.items)
        setTotal(d.total)
        setTotalPages(d.total_pages)
        setPage(p)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [noCia, punto])

  const applyFilters = () => load(1)

  const openDetail = async (row: Factura) => {
    setLoadingDetail(true)
    setAnularError('')
    try {
      const d = await regalGeneralApi.fatGetFactura(noCia, punto, row.tipo_factura, row.no_factura)
      setSelected(d as FacturaDetalle)
    } catch { /* ignore */ }
    finally { setLoadingDetail(false) }
  }

  const confirmarAnulacion = async () => {
    if (!selected || !motivo.trim()) return
    setAnulando(true)
    setAnularError('')
    try {
      await regalGeneralApi.fatAnularFactura({
        no_cia: noCia,
        punto,
        tipo_factura: selected.tipo_factura,
        no_factura: selected.no_factura,
        usuario: 'JCABREU',
        motivo: motivo.trim(),
      })
      setAnularOpen(false)
      setSelected((s) => s ? { ...s, st_anulado: 'S', estado: 'C' } : s)
      load(page)
    } catch (e: any) {
      const msg = e?.body?.detail ?? e?.message ?? 'Error al anular'
      setAnularError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setAnulando(false)
    }
  }

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, `${String(mes).padStart(2, '0')}/${ano}`)
    downloadCsv(
      `facturas-${noCia}-${punto}.csv`,
      ['Tipo', 'No.Factura', 'Fecha', 'Cliente', 'Vendedor', 'Total Línea', 'Desc.', 'ITBIS', 'Total Neto', 'Estado', 'NCF'],
      rows.map((r) => [r.tipo_factura, r.no_factura, r.fecha ?? '', r.nombre_cliente, r.vendedor,
        r.total_linea, r.descuento, r.impuesto, r.total_neto, r.estado, r.ncf ?? '']),
      meta,
    )
  }

  const exportPdf = async () => {
    const filtros = [
      filterTipo && `Tipo: ${filterTipo}`,
      filterEstado && `Estado: ${filterEstado}`,
      filterDesde && `Desde: ${filterDesde}`,
      filterHasta && `Hasta: ${filterHasta}`,
      search && `Búsqueda: ${search}`,
    ].filter(Boolean).join(' | ')
    const meta = await buildReportMeta(noCia, punto, `${String(mes).padStart(2,'0')}-${ano}`)
    printFacturas(meta, rows, filtros || undefined)
  }

  const openListadoPdf = () => {
    const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'
    const params = new URLSearchParams({ no_cia: noCia, punto })
    if (filterDesde) params.set('desde', filterDesde)
    if (filterHasta) params.set('hasta', filterHasta)
    if (filterTipo) params.set('tipo', filterTipo)
    if (filterEstado) params.set('estado', filterEstado)
    window.open(`${API_BASE}/fat/reportes/listado/pdf/?${params.toString()}`, '_blank')
  }

  const printDetail = () => {
    if (!selected) return
    const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'
    const params = new URLSearchParams({ no_cia: noCia, punto })
    window.open(
      `${API_BASE}/fat/documentos/${encodeURIComponent(selected.tipo_factura)}/${encodeURIComponent(selected.no_factura)}/pdf/?${params.toString()}`,
      '_blank'
    )
  }

  const isAnulada = selected?.st_anulado === 'S'

  return (
    <section className='space-y-4'>
      {/* Barra superior */}
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>Consulta de Facturas</h2>
          <p className='text-sm text-muted-foreground'>Empresa {noCia} · Punto {punto} — {total.toLocaleString()} factura(s)</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={exportPdf}><Printer className='mr-2 h-4 w-4' /> PDF</Button>
          <Button variant='outline' size='sm' onClick={openListadoPdf}><FileText className='mr-2 h-4 w-4' /> Imprimir PDF</Button>
          <Button variant='outline' size='sm' onClick={exportCsv}><FileSpreadsheet className='mr-2 h-4 w-4' /> Excel</Button>
          <Button variant='outline' size='sm' onClick={() => load(page)}><RefreshCw className='mr-2 h-4 w-4' /> Actualizar</Button>
        </div>
      </div>

      {/* Filtros */}
      <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6'>
        <div className='relative col-span-2'>
          <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
          <Input placeholder='Buscar cliente, NCF, No.Factura…' value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            className='h-9 pl-8' />
        </div>
        <Select value={filterTipo || '_'} onValueChange={(v) => setFilterTipo(v === '_' ? '' : v)}>
          <SelectTrigger className='h-9'><SelectValue placeholder='Tipo' /></SelectTrigger>
          <SelectContent>
            <SelectItem value='_'>Todos los tipos</SelectItem>
            <SelectItem value='FC'>FC — Crédito</SelectItem>
            <SelectItem value='FT'>FT — Contado</SelectItem>
            <SelectItem value='AF'>AF — Anulación</SelectItem>
            <SelectItem value='CO'>CO — Conduce</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEstado || '_'} onValueChange={(v) => setFilterEstado(v === '_' ? '' : v)}>
          <SelectTrigger className='h-9'><SelectValue placeholder='Estado' /></SelectTrigger>
          <SelectContent>
            <SelectItem value='_'>Todos los estados</SelectItem>
            <SelectItem value='A'>Autorizada</SelectItem>
            <SelectItem value='P'>Pendiente</SelectItem>
            <SelectItem value='C'>Cerrada</SelectItem>
          </SelectContent>
        </Select>
        <Input type='date' value={filterDesde} onChange={(e) => setFilterDesde(e.target.value)} className='h-9' title='Fecha desde' />
        <Input type='date' value={filterHasta} onChange={(e) => setFilterHasta(e.target.value)} className='h-9' title='Fecha hasta' />
      </div>
      <div className='flex gap-2'>
        <Button size='sm' onClick={applyFilters}>Aplicar filtros</Button>
        <Button variant='ghost' size='sm' onClick={() => {
          setSearch(''); setFilterTipo(''); setFilterEstado(''); setFilterDesde(''); setFilterHasta('')
          setTimeout(() => load(1), 0)
        }}>Limpiar</Button>
      </div>

      {/* Tabla */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-14'>Tipo</TableHead>
            <TableHead className='w-24'>No.Factura</TableHead>
            <TableHead className='w-24'>Fecha</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className='w-16'>Vend.</TableHead>
            <TableHead className='w-24 text-right'>Total Línea</TableHead>
            <TableHead className='w-20 text-right'>ITBIS</TableHead>
            <TableHead className='w-24 text-right'>Total Neto</TableHead>
            <TableHead className='w-24 text-center'>Estado</TableHead>
            <TableHead className='w-20 text-right'>NCF</TableHead>
            <TableHead className='w-10'></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow><TableCell colSpan={11} className='py-10 text-center text-muted-foreground'>Cargando facturas...</TableCell></TableRow>
          )}
          {!loading && rows.length === 0 && (
            <TableRow><TableCell colSpan={11} className='py-10 text-center text-muted-foreground'>No hay facturas con esos filtros.</TableCell></TableRow>
          )}
          {rows.map((row) => {
            const anulada = row.st_anulado === 'S'
            const badge = anulada
              ? { label: 'Anulada', variant: 'destructive' as const }
              : (ESTADO_BADGE[row.estado] ?? { label: row.estado, variant: 'outline' as const })
            const Icon = anulada ? XCircle : (ESTADO_ICON[row.estado] ?? AlertCircle)
            return (
              <TableRow key={`${row.tipo_factura}-${row.no_factura}`} className='cursor-pointer hover:bg-muted/50' onClick={() => openDetail(row)}>
                <TableCell className='font-mono font-semibold'>{row.tipo_factura}</TableCell>
                <TableCell className='font-mono'>{row.no_factura}</TableCell>
                <TableCell>{row.fecha ?? '—'}</TableCell>
                <TableCell className='max-w-[200px] truncate'>{row.nombre_cliente || `Cliente #${row.no_cliente}`}</TableCell>
                <TableCell className='font-mono'>{row.vendedor}</TableCell>
                <TableCell className='text-right font-mono'>{fmtN(row.total_linea)}</TableCell>
                <TableCell className='text-right font-mono'>{fmtN(row.impuesto)}</TableCell>
                <TableCell className='text-right font-mono font-semibold'>{fmtN(row.total_neto)}</TableCell>
                <TableCell className='text-center'>
                  <Badge variant={badge.variant} className='gap-1'>
                    <Icon className='h-3 w-3' />
                    {badge.label}
                  </Badge>
                </TableCell>
                <TableCell className='text-right font-mono'>{row.ncf_dgi || (row.ncf ?? '—')}</TableCell>
                <TableCell>
                  <Button variant='ghost' size='icon' className='h-7 w-7' onClick={(e) => { e.stopPropagation(); openDetail(row) }}>
                    <Eye className='h-3.5 w-3.5' />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {/* Paginación */}
      <div className='flex items-center justify-between text-sm'>
        <span className='text-muted-foreground'>Página {page} de {totalPages} — {total.toLocaleString()} total</span>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' disabled={page <= 1} onClick={() => load(page - 1)}>
            <ChevronLeft className='h-4 w-4' /> Anterior
          </Button>
          <Button variant='outline' size='sm' disabled={page >= totalPages} onClick={() => load(page + 1)}>
            Siguiente <ChevronRight className='h-4 w-4' />
          </Button>
        </div>
      </div>

      {/* Detalle modal — mismo patrón del modal de búsqueda de producto:
          header con título + chips de info + botones; sub-bar de filtros (aquí, datos
          del cliente); body scrollable con tabla; footer con totales sticky. */}
      <Dialog open={!!selected || loadingDetail} onOpenChange={() => setSelected(null)}>
        <DialogContent className='w-[80vw] h-[70vh] max-w-none sm:max-w-none flex flex-col p-0 gap-0 overflow-hidden'>
          <DialogHeader className='px-6 py-4 border-b shrink-0 bg-white'>
            <div className='flex items-center gap-4 flex-wrap'>
              <DialogTitle className='text-lg mr-2'>
                {selected
                  ? `Factura ${selected.tipo_factura} ${selected.no_factura}`
                  : 'Cargando…'}
              </DialogTitle>

              {selected && (
                <>
                  <Badge variant={ESTADO_BADGE[selected.estado]?.variant ?? 'outline'} className='gap-1'>
                    {ESTADO_BADGE[selected.estado]?.label ?? selected.estado}
                  </Badge>
                  {(selected.ncf_dgi || selected.codigo_ncf) && (
                    <span className='text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded px-2 py-1 font-mono'>
                      NCF: {selected.ncf_dgi || `${selected.codigo_ncf} ${selected.ncf ?? ''}`}
                    </span>
                  )}
                  <span className='text-xs text-gray-500'>
                    {selected.fecha} · {selected.vendedor || 'Sin vendedor'}
                  </span>

                  <div className='ml-auto flex gap-2'>
                    <Button variant='outline' size='sm' onClick={printDetail}>
                      <Printer className='mr-1 h-4 w-4' /> Imprimir
                    </Button>
                    {isAnulada ? (
                      <Badge variant='destructive' className='self-center'>Anulada</Badge>
                    ) : (
                      <Button variant='destructive' size='sm' onClick={() => { setMotivo(''); setAnularError(''); setAnularOpen(true) }}>
                        <XCircle className='mr-1 h-4 w-4' /> Anular
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </DialogHeader>

          {/* Sub-bar tipo "filtros" pero con datos del cliente */}
          {selected && !loadingDetail && (
            <div className='px-6 py-3 border-b shrink-0 bg-gray-50 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-sm'>
              <div className='md:col-span-2 min-w-0'>
                <span className='text-xs text-gray-500 block'>Cliente</span>
                <span className='font-semibold truncate block'>
                  {selected.nombre_cliente || `Cliente #${selected.no_cliente}`}
                </span>
              </div>
              <div>
                <span className='text-xs text-gray-500 block'>Forma pago</span>
                <span>{selected.forma_pago || '—'}{selected.plazo_pago ? ` · ${selected.plazo_pago}d` : ''}</span>
              </div>
              <div>
                <span className='text-xs text-gray-500 block'>Generado CNT</span>
                <span>{selected.st_generado_cnt === 'S' ? 'Sí' : 'No'}</span>
              </div>
            </div>
          )}

          {loadingDetail && (
            <div className='flex-1 flex items-center justify-center text-muted-foreground text-base'>
              Cargando detalle…
            </div>
          )}

          {selected && !loadingDetail && (
            <div className='flex-1 overflow-y-auto px-6 py-2'>
              <Table>
                <TableHeader className='sticky top-0 bg-white z-10'>
                  <TableRow>
                    <TableHead className='w-10'>#</TableHead>
                    <TableHead className='w-28'>Producto</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className='w-20 text-right'>Cant.</TableHead>
                    <TableHead className='w-24 text-right'>Precio</TableHead>
                    <TableHead className='w-16 text-right'>%Desc</TableHead>
                    <TableHead className='w-16 text-right'>%ITBIS</TableHead>
                    <TableHead className='w-28 text-right'>Neto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.lineas.filter((l) => l.st_anulado !== 'S').length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className='text-center text-gray-400 py-12 text-base'>
                        Esta factura no tiene líneas activas.
                      </TableCell>
                    </TableRow>
                  )}
                  {selected.lineas.filter((l) => l.st_anulado !== 'S').map((l) => (
                    <TableRow key={l.no_linea} className='hover:bg-blue-50'>
                      <TableCell className='font-mono text-xs text-gray-500'>{l.no_linea}</TableCell>
                      <TableCell className='font-mono text-sm font-semibold'>{l.no_produ}</TableCell>
                      <TableCell className='text-sm'>{l.descripcion}</TableCell>
                      <TableCell className='text-right font-mono'>{l.cantidad.toLocaleString('en-US')}</TableCell>
                      <TableCell className='text-right font-mono'>{fmtN(l.precio)}</TableCell>
                      <TableCell className='text-right text-sm'>{l.porc_descuento ? `${l.porc_descuento}%` : '—'}</TableCell>
                      <TableCell className='text-right text-sm'>{l.porciento_impuesto ? `${l.porciento_impuesto}%` : '—'}</TableCell>
                      <TableCell className='text-right font-mono font-bold'>{fmtN(l.monto_neto)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {selected.nota && (
                <p className='mt-3 rounded border bg-muted/30 p-2 text-xs text-muted-foreground'>
                  <strong>Nota:</strong> {selected.nota}
                </p>
              )}
            </div>
          )}

          {/* Footer sticky con totales */}
          {selected && !loadingDetail && (
            <div className='px-6 py-3 border-t shrink-0 bg-gray-50 flex items-center justify-between text-sm'>
              <span className='text-gray-500'>
                {selected.lineas.filter((l) => l.st_anulado !== 'S').length} línea{selected.lineas.filter((l) => l.st_anulado !== 'S').length !== 1 ? 's' : ''}
              </span>
              <div className='flex items-center gap-6 font-mono'>
                <span className='text-gray-600'>Subtotal <b className='ml-1'>{fmtN(selected.total_linea)}</b></span>
                <span className='text-gray-600'>Desc. <b className='ml-1'>{fmtN(selected.descuento)}</b></span>
                <span className='text-gray-600'>ITBIS <b className='ml-1'>{fmtN(selected.impuesto)}</b></span>
                {(selected.propina ?? 0) > 0 && (
                  <span className='text-gray-600'>Propina <b className='ml-1'>{fmtN(selected.propina)}</b></span>
                )}
                <span className='text-base font-bold'>Total <span className='ml-1'>{fmtN(selected.total_neto)}</span></span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Anulación dialog */}
      <Dialog open={anularOpen} onOpenChange={setAnularOpen}>
        <DialogContent className='sm:max-w-md p-6'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2 text-destructive'>
              <AlertTriangle className='h-5 w-5' /> Confirmar Anulación
            </DialogTitle>
          </DialogHeader>
          <div className='space-y-3 text-sm'>
            <p>
              Va a anular la factura <strong>{selected?.tipo_factura} {selected?.no_factura}</strong>.
              Esta acción no se puede deshacer.
            </p>
            <div className='space-y-1'>
              <Label className='text-xs'>Motivo <span className='text-destructive'>*</span></Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder='Describa el motivo de anulación...'
                rows={3}
                className='resize-none'
              />
            </div>
            {anularError && <p className='text-xs text-destructive'>{anularError}</p>}
            <div className='flex justify-end gap-2 pt-1'>
              <Button variant='outline' size='sm' onClick={() => setAnularOpen(false)} disabled={anulando}>
                Cancelar
              </Button>
              <Button variant='destructive' size='sm' onClick={confirmarAnulacion}
                disabled={anulando || !motivo.trim()}>
                <XCircle className='mr-1 h-3 w-3' />
                {anulando ? 'Anulando...' : 'Confirmar Anulación'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
