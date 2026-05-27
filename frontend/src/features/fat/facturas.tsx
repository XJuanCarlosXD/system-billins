import { useEffect, useState } from 'react'
import {
  AlertCircle, CheckCircle2, Clock, FileSpreadsheet,
  Printer, RefreshCw, Search, XCircle, ChevronLeft, ChevronRight, Eye, AlertTriangle,
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
import { buildReportMeta, downloadCsv, fmtN, printFacturaDetalle, printFacturas } from './fat-export'

interface Props { noCia: string; punto: string; mes: number; ano: number }

type Factura = {
  no_cia: string; punto: string; tipo_factura: string; no_factura: string
  no_cliente: number; nombre_cliente: string; fecha: string | null
  vendedor: string; total_linea: number; descuento: number
  impuesto: number; total_neto: number; estado: string
  ncf: number | null; codigo_ncf: string; tipo_ncf_fiscal: string
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

const ESTADO_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  A: { label: 'Autorizada', variant: 'default' },
  P: { label: 'Pendiente',  variant: 'secondary' },
  C: { label: 'Cancelada',  variant: 'destructive' },
}

const ESTADO_ICON: Record<string, typeof CheckCircle2> = {
  A: CheckCircle2, P: Clock, C: XCircle,
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

  const printDetail = async () => {
    if (!selected) return
    const meta = await buildReportMeta(noCia, punto, `${String(mes).padStart(2,'0')}-${ano}`)
    printFacturaDetalle(meta, {
      tipo_factura: selected.tipo_factura,
      no_factura: selected.no_factura,
      fecha: selected.fecha,
      no_cliente: selected.no_cliente,
      nombre_cliente: selected.nombre_cliente,
      vendedor: selected.vendedor,
      forma_pago: selected.forma_pago,
      plazo_pago: selected.plazo_pago,
      codigo_ncf: selected.codigo_ncf,
      ncf: selected.ncf,
      nota: selected.nota,
      total_linea: selected.total_linea,
      descuento: selected.descuento,
      impuesto: selected.impuesto,
      propina: selected.propina,
      total_neto: selected.total_neto,
      estado: selected.estado,
      lineas: selected.lineas,
    })
  }

  const isAnulada = selected?.st_anulado === 'S' || selected?.estado === 'C'

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
            <SelectItem value='C'>Cancelada</SelectItem>
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
            const badge = ESTADO_BADGE[row.estado] ?? { label: row.estado, variant: 'outline' as const }
            const Icon = ESTADO_ICON[row.estado] ?? AlertCircle
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
                <TableCell className='text-right font-mono'>{row.ncf ?? '—'}</TableCell>
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

      {/* Detalle modal */}
      <Dialog open={!!selected || loadingDetail} onOpenChange={() => setSelected(null)}>
        <DialogContent className='max-w-4xl max-h-[85vh] overflow-y-auto'>
          <DialogHeader>
            <div className='flex items-center justify-between'>
              <DialogTitle>
                {selected
                  ? `Factura ${selected.tipo_factura} ${selected.no_factura}`
                  : 'Cargando…'}
              </DialogTitle>
              {selected && (
                <div className='flex gap-2 mr-8'>
                  <Button variant='outline' size='sm' onClick={printDetail}>
                    <Printer className='mr-2 h-4 w-4' /> Imprimir
                  </Button>
                  {isAnulada ? (
                    <Badge variant='destructive' className='self-center'>Anulada</Badge>
                  ) : (
                    <Button variant='destructive' size='sm' onClick={() => { setMotivo(''); setAnularError(''); setAnularOpen(true) }}>
                      <XCircle className='mr-1 h-4 w-4' /> Anular
                    </Button>
                  )}
                </div>
              )}
            </div>
          </DialogHeader>

          {loadingDetail && <p className='py-8 text-center text-muted-foreground'>Cargando detalle…</p>}
          {selected && !loadingDetail && (
            <div className='space-y-4 text-sm'>
              {/* Info general */}
              <div className='grid grid-cols-2 gap-x-8 gap-y-1 rounded-lg border p-3'>
                <div><span className='text-muted-foreground'>Cliente:</span> <strong>{selected.nombre_cliente || `#${selected.no_cliente}`}</strong></div>
                <div><span className='text-muted-foreground'>Fecha:</span> {selected.fecha}</div>
                <div><span className='text-muted-foreground'>Vendedor:</span> {selected.vendedor || '—'}</div>
                <div><span className='text-muted-foreground'>Forma pago:</span> {selected.forma_pago || '—'}</div>
                <div><span className='text-muted-foreground'>Plazo:</span> {selected.plazo_pago ? `${selected.plazo_pago} días` : '—'}</div>
                <div><span className='text-muted-foreground'>NCF:</span> <span className='font-mono'>{selected.codigo_ncf} {selected.ncf ?? ''}</span></div>
                <div><span className='text-muted-foreground'>Estado:</span> <Badge variant={ESTADO_BADGE[selected.estado]?.variant ?? 'outline'}>{ESTADO_BADGE[selected.estado]?.label ?? selected.estado}</Badge></div>
                <div><span className='text-muted-foreground'>Generado CNT:</span> {selected.st_generado_cnt === 'S' ? 'Sí' : 'No'}</div>
              </div>

              {/* Líneas */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-10'>#</TableHead>
                    <TableHead className='w-24'>Producto</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className='w-16 text-right'>Cant.</TableHead>
                    <TableHead className='w-20 text-right'>Precio</TableHead>
                    <TableHead className='w-16 text-right'>%Desc</TableHead>
                    <TableHead className='w-20 text-right'>%ITBIS</TableHead>
                    <TableHead className='w-24 text-right'>Neto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.lineas.filter((l) => l.st_anulado !== 'S').map((l) => (
                    <TableRow key={l.no_linea}>
                      <TableCell>{l.no_linea}</TableCell>
                      <TableCell className='font-mono'>{l.no_produ}</TableCell>
                      <TableCell>{l.descripcion}</TableCell>
                      <TableCell className='text-right'>{l.cantidad.toLocaleString('en-US')}</TableCell>
                      <TableCell className='text-right font-mono'>{fmtN(l.precio)}</TableCell>
                      <TableCell className='text-right'>{l.porc_descuento ? `${l.porc_descuento}%` : ''}</TableCell>
                      <TableCell className='text-right'>{l.porciento_impuesto ? `${l.porciento_impuesto}%` : ''}</TableCell>
                      <TableCell className='text-right font-mono'>{fmtN(l.monto_neto)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Totales */}
              <div className='flex justify-end'>
                <table className='text-sm'>
                  <tbody>
                    <tr><td className='pr-8 text-muted-foreground'>Total Línea</td><td className='text-right font-mono'>{fmtN(selected.total_linea)}</td></tr>
                    <tr><td className='pr-8 text-muted-foreground'>Descuento</td><td className='text-right font-mono'>{fmtN(selected.descuento)}</td></tr>
                    <tr><td className='pr-8 text-muted-foreground'>ITBIS</td><td className='text-right font-mono'>{fmtN(selected.impuesto)}</td></tr>
                    {(selected.propina ?? 0) > 0 && (
                      <tr><td className='pr-8 text-muted-foreground'>Propina</td><td className='text-right font-mono'>{fmtN(selected.propina)}</td></tr>
                    )}
                    <tr className='border-t font-semibold'><td className='pt-1 pr-8'>Total Neto</td><td className='pt-1 text-right font-mono'>{fmtN(selected.total_neto)}</td></tr>
                  </tbody>
                </table>
              </div>

              {selected.nota && (
                <p className='rounded border bg-muted/30 p-2 text-xs text-muted-foreground'><strong>Nota:</strong> {selected.nota}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Anulación dialog */}
      <Dialog open={anularOpen} onOpenChange={setAnularOpen}>
        <DialogContent className='max-w-sm'>
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
