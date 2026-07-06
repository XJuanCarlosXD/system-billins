import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Banknote, CreditCard, HandCoins, RefreshCw, Wallet } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fmtN } from './fat-export'
import { FacturaDetalleDialog, type FacturaDetalleData } from './factura-detalle-dialog'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface Props { noCia: string; punto: string }

type FacturaPendiente = {
  tipo_factura: string; no_factura: string; fecha: string | null
  nombre_cliente: string; total_neto: number; forma_pago: string
  valor_recibido: number; valor_devuelto: number
  st_anulado: string; ncf_dgi: string
}

const TODAY = new Date().toISOString().slice(0, 10)

// Categoriza forma_pago (descripcion real, ej. "EFECTIVO", "CHEQUE",
// "TRANSFERENCIA") en 3 cards resumen.
function categoriaPago(forma: string): 'Efectivo' | 'Cheque' | 'Otros' {
  const f = (forma || '').toLowerCase()
  if (/efectivo|cash/.test(f)) return 'Efectivo'
  if (/cheque/.test(f)) return 'Cheque'
  return 'Otros'
}

export function CajeroFat({ noCia, punto }: Props) {
  const [fecha, setFecha] = useState(TODAY)
  const [selected, setSelected] = useState<FacturaDetalleData | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Registrar/corregir cobro
  const [cobrarTarget, setCobrarTarget] = useState<FacturaPendiente | null>(null)
  const [cobrarRecibido, setCobrarRecibido] = useState('')
  const [cobrarLoading, setCobrarLoading] = useState(false)
  const [cobrarError, setCobrarError] = useState('')

  const q = useQuery({
    queryKey: ['fat-cajero-pendientes', noCia, punto, fecha],
    queryFn: () => regalGeneralApi.fatCajeroPendientes(noCia, punto, fecha),
    enabled: !!noCia && !!fecha,
    staleTime: 30_000,
  })

  const items = q.data?.items ?? []

  const cardTotales = items.reduce(
    (acc, f) => {
      const cat = categoriaPago(f.forma_pago)
      acc[cat].total += f.total_neto || 0
      acc[cat].cantidad += 1
      return acc
    },
    {
      Efectivo: { total: 0, cantidad: 0 },
      Cheque: { total: 0, cantidad: 0 },
      Otros: { total: 0, cantidad: 0 },
    }
  )

  const openDetail = async (tipo: string, noFactura: string) => {
    setLoadingDetail(true)
    try {
      const d = await regalGeneralApi.fatGetFactura(noCia, punto, tipo, noFactura)
      setSelected(d as FacturaDetalleData)
    } catch { /* ignore */ }
    finally { setLoadingDetail(false) }
  }

  // La Vista de Cajero imprime el ticket POS (80mm, ReportLab), no el
  // reporte de detalle A4 que usa Consulta de Facturas.
  const printDetail = () => {
    if (!selected) return
    const qs = new URLSearchParams({ no_cia: noCia, punto })
    window.open(
      `${API_BASE}/fat/documentos/${selected.tipo_factura}/${selected.no_factura}/pos-pdf/?${qs.toString()}`,
      '_blank',
      'noopener'
    )
  }

  const openCobrar = (e: React.MouseEvent, row: FacturaPendiente) => {
    e.stopPropagation()
    setCobrarTarget(row)
    setCobrarRecibido(row.valor_recibido > 0 ? String(row.valor_recibido) : '')
    setCobrarError('')
  }

  const cobrarRecibidoNum = Number((cobrarRecibido || '0').replace(',', '.')) || 0
  const cobrarDevuelto = cobrarTarget ? Math.max(0, cobrarRecibidoNum - cobrarTarget.total_neto) : 0

  const confirmCobrar = async () => {
    if (!cobrarTarget) return
    if (cobrarRecibidoNum < cobrarTarget.total_neto) {
      setCobrarError(`Recibido (${fmtN(cobrarRecibidoNum)}) es menor al total (${fmtN(cobrarTarget.total_neto)})`)
      return
    }
    setCobrarLoading(true)
    setCobrarError('')
    try {
      await regalGeneralApi.fatCobrarFactura({
        no_cia: noCia,
        punto,
        tipo_factura: cobrarTarget.tipo_factura,
        no_factura: cobrarTarget.no_factura,
        valor_recibido: cobrarRecibidoNum,
      })
      setCobrarTarget(null)
      q.refetch()
    } catch (err: any) {
      setCobrarError(err?.message ?? 'Error al registrar el cobro.')
    } finally {
      setCobrarLoading(false)
    }
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='flex items-center gap-2 text-lg font-semibold'>
            <Wallet className='h-5 w-5' /> Vista de Cajero
          </h2>
          <p className='text-sm text-muted-foreground'>
            Empresa {noCia} · Punto {punto} — facturas del día aún sin cuadre cerrado
          </p>
        </div>
        <Button variant='outline' size='sm' onClick={() => q.refetch()}>
          <RefreshCw className='mr-1 h-4 w-4' /> Actualizar
        </Button>
      </div>

      <div className='flex items-end gap-4 rounded-md border bg-muted/30 p-3'>
        <div className='space-y-1'>
          <Label htmlFor='cajero-fecha' className='text-xs text-muted-foreground'>Fecha</Label>
          <Input id='cajero-fecha' type='date' value={fecha}
                 onChange={(e) => setFecha(e.target.value)} className='h-9 w-44' />
        </div>
        {q.isFetching && <span className='pb-2 text-xs text-muted-foreground'>Cargando…</span>}
        {q.error && <span className='pb-2 text-xs text-red-600'>Error al cargar.</span>}
      </div>

      <div className='grid gap-3 sm:grid-cols-3'>
        <div className='rounded-md border bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/20'>
          <div className='flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300'>
            <Banknote className='h-4 w-4' /> Recibido en Efectivo
          </div>
          <div className='mt-1 font-mono text-xl font-semibold tabular-nums'>
            {fmtN(cardTotales.Efectivo.total)}
          </div>
          <div className='text-xs text-muted-foreground'>
            {cardTotales.Efectivo.cantidad} {cardTotales.Efectivo.cantidad === 1 ? 'factura' : 'facturas'}
          </div>
        </div>
        <div className='rounded-md border bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/20'>
          <div className='flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-300'>
            <HandCoins className='h-4 w-4' /> Por Cheque
          </div>
          <div className='mt-1 font-mono text-xl font-semibold tabular-nums'>
            {fmtN(cardTotales.Cheque.total)}
          </div>
          <div className='text-xs text-muted-foreground'>
            {cardTotales.Cheque.cantidad} {cardTotales.Cheque.cantidad === 1 ? 'factura' : 'facturas'}
          </div>
        </div>
        <div className='rounded-md border bg-muted/30 p-3'>
          <div className='flex items-center gap-2 text-xs font-medium text-muted-foreground'>
            <CreditCard className='h-4 w-4' /> Otras Formas de Pago
          </div>
          <div className='mt-1 font-mono text-xl font-semibold tabular-nums'>
            {fmtN(cardTotales.Otros.total)}
          </div>
          <div className='text-xs text-muted-foreground'>
            {cardTotales.Otros.cantidad} {cardTotales.Otros.cantidad === 1 ? 'factura' : 'facturas'} (tarjeta, transferencia, etc.)
          </div>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-28'>No.</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className='w-32'>NCF</TableHead>
            <TableHead className='w-24'>Forma Pago</TableHead>
            <TableHead className='w-28 text-right'>Total</TableHead>
            <TableHead className='w-28 text-right'>Recibido</TableHead>
            <TableHead className='w-28 text-right'>Devuelto</TableHead>
            <TableHead className='w-24 text-center'>Estado</TableHead>
            <TableHead className='w-20'></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.isLoading && (
            <TableRow><TableCell colSpan={9} className='py-10 text-center text-muted-foreground'>Cargando facturas del día…</TableCell></TableRow>
          )}
          {!q.isLoading && items.length === 0 && (
            <TableRow><TableCell colSpan={9} className='py-10 text-center text-muted-foreground'>No hay facturas pendientes de cuadre para el {fecha}.</TableCell></TableRow>
          )}
          {items.map((f) => {
            const anulada = f.st_anulado === 'S'
            return (
              <TableRow
                key={`${f.tipo_factura}-${f.no_factura}`}
                className={`cursor-pointer hover:bg-muted/50 ${anulada ? 'opacity-60' : ''}`}
                onClick={() => openDetail(f.tipo_factura, f.no_factura)}
              >
                <TableCell className='font-mono'>{f.tipo_factura}-{f.no_factura}</TableCell>
                <TableCell className='max-w-[220px] truncate'>{f.nombre_cliente}</TableCell>
                <TableCell className='font-mono text-xs'>{f.ncf_dgi || '—'}</TableCell>
                <TableCell className='text-sm'>{f.forma_pago}</TableCell>
                <TableCell className='text-right font-mono tabular-nums'>{fmtN(f.total_neto)}</TableCell>
                <TableCell className='text-right font-mono tabular-nums'>{f.valor_recibido > 0 ? fmtN(f.valor_recibido) : '—'}</TableCell>
                <TableCell className='text-right font-mono tabular-nums'>{f.valor_recibido > 0 ? fmtN(f.valor_devuelto) : '—'}</TableCell>
                <TableCell className='text-center'>
                  {anulada
                    ? <Badge variant='destructive'>Anulada</Badge>
                    : <Badge variant='default'>OK</Badge>}
                </TableCell>
                <TableCell>
                  {!anulada && (
                    <Button
                      variant='ghost' size='sm' className='h-7 px-2 text-xs'
                      onClick={(e) => openCobrar(e, f)}
                    >
                      Cobrar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <FacturaDetalleDialog
        factura={selected}
        loading={loadingDetail}
        onClose={() => setSelected(null)}
        onPrint={printDetail}
      />

      {/* Registrar/corregir cobro */}
      <Dialog open={!!cobrarTarget} onOpenChange={() => { if (!cobrarLoading) setCobrarTarget(null) }}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle className='text-xl'>Registrar Cobro</DialogTitle>
          </DialogHeader>
          {cobrarTarget && (
            <div className='space-y-5'>
              <div className='flex items-center justify-between rounded-md border bg-muted/30 p-3 text-sm'>
                <span>
                  Factura <strong className='font-mono'>{cobrarTarget.tipo_factura} {cobrarTarget.no_factura}</strong>
                </span>
                <span>
                  Total a pagar: <strong className='font-mono text-base'>{fmtN(cobrarTarget.total_neto)}</strong>
                </span>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='cobrar-recibido' className='text-base font-semibold'>Recibido</Label>
                <Input
                  id='cobrar-recibido'
                  type='number' step='0.01' min='0' placeholder='0.00'
                  value={cobrarRecibido}
                  onChange={(e) => setCobrarRecibido(e.target.value)}
                  disabled={cobrarLoading}
                  autoFocus
                  className='h-16 text-right font-mono text-3xl font-bold tabular-nums'
                />
              </div>

              <div className={`rounded-md border p-4 ${cobrarRecibidoNum > 0 && cobrarRecibidoNum < cobrarTarget.total_neto ? 'border-destructive bg-destructive/10' : 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20'}`}>
                <div className='text-base font-semibold'>A devolver</div>
                <div className='text-right font-mono text-3xl font-bold tabular-nums'>{fmtN(cobrarDevuelto)}</div>
              </div>

              {cobrarError && (
                <p className='rounded border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive'>{cobrarError}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant='outline' size='lg' onClick={() => setCobrarTarget(null)} disabled={cobrarLoading}>Cancelar</Button>
            <Button size='lg' onClick={confirmCobrar} disabled={cobrarLoading}>
              {cobrarLoading ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
