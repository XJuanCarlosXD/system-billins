import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Wallet } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fmtN } from './fat-export'
import { FacturaDetalleDialog, type FacturaDetalleData } from './factura-detalle-dialog'

interface Props { noCia: string; punto: string }

const TODAY = new Date().toISOString().slice(0, 10)

export function CajeroFat({ noCia, punto }: Props) {
  const [fecha, setFecha] = useState(TODAY)
  const [selected, setSelected] = useState<FacturaDetalleData | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const q = useQuery({
    queryKey: ['fat-cajero-pendientes', noCia, punto, fecha],
    queryFn: () => regalGeneralApi.fatCajeroPendientes(noCia, punto, fecha),
    enabled: !!noCia && !!fecha,
    staleTime: 30_000,
  })

  const items = q.data?.items ?? []

  const openDetail = async (tipo: string, noFactura: string) => {
    setLoadingDetail(true)
    try {
      const d = await regalGeneralApi.fatGetFactura(noCia, punto, tipo, noFactura)
      setSelected(d as FacturaDetalleData)
    } catch { /* ignore */ }
    finally { setLoadingDetail(false) }
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.isLoading && (
            <TableRow><TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>Cargando facturas del día…</TableCell></TableRow>
          )}
          {!q.isLoading && items.length === 0 && (
            <TableRow><TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>No hay facturas pendientes de cuadre para el {fecha}.</TableCell></TableRow>
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
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <FacturaDetalleDialog
        factura={selected}
        loading={loadingDetail}
        onClose={() => setSelected(null)}
      />
    </section>
  )
}
