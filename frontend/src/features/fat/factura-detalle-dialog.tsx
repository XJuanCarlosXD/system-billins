import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Printer } from 'lucide-react'
import { fmtN } from './fat-export'

export type FacturaDetalleData = {
  tipo_factura: string; no_factura: string
  nombre_cliente: string; no_cliente: number
  fecha: string | null; vendedor: string; forma_pago: string
  plazo_pago: number; ncf_dgi?: string; codigo_ncf: string; ncf: number | null
  estado: string; st_anulado: string; st_generado_cnt: string
  motivo_anulacion?: string
  valor_recibido?: number; valor_devuelto?: number
  total_linea: number; descuento: number; impuesto: number
  propina?: number; total_neto: number
  nota?: string
  lineas: Array<{
    no_linea: number; no_produ: string; descripcion: string
    cantidad: number; precio: number; porc_descuento: number
    porciento_impuesto: number; monto_neto: number; st_anulado: string
  }>
}

const ESTADO_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  A: { label: 'Autorizada', variant: 'default' },
  P: { label: 'Pendiente',  variant: 'secondary' },
  C: { label: 'Cancelada',  variant: 'destructive' },
}

interface Props {
  factura: FacturaDetalleData | null
  loading: boolean
  onClose: () => void
  onPrint?: () => void
}

export function FacturaDetalleDialog({ factura, loading, onClose, onPrint }: Props) {
  return (
    <Dialog open={!!factura || loading} onOpenChange={onClose}>
      <DialogContent className='max-w-[70vw] max-h-[70vh] overflow-y-auto'>
        <DialogHeader>
          <div className='flex items-center justify-between'>
            <DialogTitle>
              {factura ? `Factura ${factura.tipo_factura} ${factura.no_factura}` : 'Cargando…'}
            </DialogTitle>
            {factura && onPrint && (
              <Button variant='outline' size='sm' onClick={onPrint} className='mr-8'>
                <Printer className='mr-2 h-4 w-4' /> Imprimir
              </Button>
            )}
          </div>
        </DialogHeader>

        {loading && <p className='py-8 text-center text-muted-foreground'>Cargando detalle…</p>}
        {factura && !loading && (
          <div className='space-y-4 text-sm'>
            <div className='grid grid-cols-2 gap-x-8 gap-y-1 rounded-lg border p-3'>
              <div><span className='text-muted-foreground'>Cliente:</span> <strong>{factura.nombre_cliente || `#${factura.no_cliente}`}</strong></div>
              <div><span className='text-muted-foreground'>Fecha:</span> {factura.fecha}</div>
              <div><span className='text-muted-foreground'>Vendedor:</span> {factura.vendedor || '—'}</div>
              <div><span className='text-muted-foreground'>Forma pago:</span> {factura.forma_pago || '—'}</div>
              <div><span className='text-muted-foreground'>Plazo:</span> {factura.plazo_pago ? `${factura.plazo_pago} días` : '—'}</div>
              <div><span className='text-muted-foreground'>NCF:</span> <span className='font-mono'>{factura.ncf_dgi || `${factura.codigo_ncf} ${factura.ncf ?? ''}`}</span></div>
              <div><span className='text-muted-foreground'>Estado:</span> <Badge variant={factura.st_anulado === 'S' ? 'destructive' : (ESTADO_BADGE[factura.estado]?.variant ?? 'outline')}>{factura.st_anulado === 'S' ? 'Anulada' : (ESTADO_BADGE[factura.estado]?.label ?? factura.estado)}</Badge></div>
              <div><span className='text-muted-foreground'>Generado CNT:</span> {factura.st_generado_cnt === 'S' ? 'Sí' : 'No'}</div>
              {factura.st_anulado === 'S' && factura.motivo_anulacion && (
                <div className='col-span-2'><span className='text-muted-foreground'>Motivo anulación:</span> <span className='text-destructive'>{factura.motivo_anulacion}</span></div>
              )}
            </div>

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
                {factura.lineas.filter((l) => l.st_anulado !== 'S').map((l) => (
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

            <div className='flex justify-end'>
              <table className='text-sm'>
                <tbody>
                  <tr><td className='pr-8 text-muted-foreground'>Total Línea</td><td className='text-right font-mono'>{fmtN(factura.total_linea)}</td></tr>
                  <tr><td className='pr-8 text-muted-foreground'>Descuento</td><td className='text-right font-mono'>{fmtN(factura.descuento)}</td></tr>
                  <tr><td className='pr-8 text-muted-foreground'>ITBIS</td><td className='text-right font-mono'>{fmtN(factura.impuesto)}</td></tr>
                  {(factura.propina ?? 0) > 0 && (
                    <tr><td className='pr-8 text-muted-foreground'>Propina</td><td className='text-right font-mono'>{fmtN(factura.propina!)}</td></tr>
                  )}
                  <tr className='border-t font-semibold'><td className='pt-1 pr-8'>Total Neto</td><td className='pt-1 text-right font-mono'>{fmtN(factura.total_neto)}</td></tr>
                  {(factura.valor_recibido ?? 0) > 0 && (
                    <>
                      <tr><td className='pr-8 text-muted-foreground'>Recibido</td><td className='text-right font-mono'>{fmtN(factura.valor_recibido!)}</td></tr>
                      <tr><td className='pr-8 text-muted-foreground'>Devuelto</td><td className='text-right font-mono'>{fmtN(factura.valor_devuelto ?? 0)}</td></tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {factura.nota && (
              <p className='rounded border bg-muted/30 p-2 text-xs text-muted-foreground'><strong>Nota:</strong> {factura.nota}</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
