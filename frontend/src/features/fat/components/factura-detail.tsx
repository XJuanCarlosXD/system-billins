import { useState } from 'react'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Loader2, CheckCircle, XCircle, Printer } from 'lucide-react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useFacturaForm } from '@/hooks/use-fat-facturas'
import { FATFactura } from '@/services/fat-api'

interface FATFacturaDetailProps {
  factura: FATFactura
  onBack: () => void
  onEdit: (factura: FATFactura) => void
}

export function FATFacturaDetail({
  factura,
  onBack,
  onEdit,
}: FATFacturaDetailProps) {
  const form = useFacturaForm()
  const [actionsLoading, setActionsLoading] = useState(false)

  const handleGenerar = async () => {
    setActionsLoading(true)
    const resultado = await form.generar(factura.no_factura)
    setActionsLoading(false)
    if (resultado) {
      onBack()
    }
  }

  const handleAnular = async () => {
    if (!confirm('¿Está seguro que desea anular esta factura?')) return
    setActionsLoading(true)
    const resultado = await form.anular(factura.no_factura)
    setActionsLoading(false)
    if (resultado) {
      onBack()
    }
  }

  const handleImprimir = async () => {
    setActionsLoading(true)
    const resultado = await form.imprimir(factura.no_factura)
    setActionsLoading(false)
    if (resultado) {
      toast.success('Factura marcada como impresa')
    }
  }

  const getEstadoBadge = () => {
    // En SIGAF legacy: P=Pendiente (sin autorizar), A=Autorizada (lista para
    // imprimir), C=Cerrada (impresa/finalizada). La ANULACION va aparte via
    // st_anulado='S'; estado='C' NO significa anulada.
    if (factura.st_anulado === 'S') {
      return <Badge variant='destructive'><XCircle className='h-3 w-3 mr-1' /> Anulada</Badge>
    }
    switch (factura.estado) {
      case 'A':
        return <Badge><CheckCircle className='h-3 w-3 mr-1' /> Autorizada</Badge>
      case 'P':
        return <Badge variant='secondary'>Pendiente</Badge>
      case 'C':
        return <Badge variant='outline'><CheckCircle className='h-3 w-3 mr-1' /> Cerrada</Badge>
      default:
        return <Badge variant='outline'>Desconocido</Badge>
    }
  }

  return (
    <>
      <Header>
        <Button variant='ghost' size='sm' onClick={onBack} className='me-2'>
          <ArrowLeft className='h-4 w-4' />
        </Button>
        <h2 className='text-lg font-semibold me-auto'>
          Factura {factura.no_factura}
        </h2>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main fluid>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
          <Card>
            <CardContent className='pt-6'>
              <p className='text-sm text-muted-foreground mb-1'>Estado</p>
              <div className='flex items-center gap-2'>
                {getEstadoBadge()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className='pt-6'>
              <p className='text-sm text-muted-foreground mb-1'>Total Neto</p>
              <p className='text-2xl font-bold font-mono'>
                {factura.total_neto.toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className='pt-6'>
              <p className='text-sm text-muted-foreground mb-1'>Fecha</p>
              <p className='text-lg font-semibold'>{factura.fecha}</p>
            </CardContent>
          </Card>
        </div>

        <Card className='mb-6'>
          <CardHeader>
            <CardTitle>Datos Generales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-3 gap-4'>
              <div>
                <p className='text-sm text-muted-foreground mb-1'>No. Cliente</p>
                <p className='font-semibold'>{factura.no_cliente}</p>
              </div>
              <div>
                <p className='text-sm text-muted-foreground mb-1'>Tipo Factura</p>
                <p className='font-semibold'>{factura.tipo_factura}</p>
              </div>
              <div>
                <p className='text-sm text-muted-foreground mb-1'>Vendedor</p>
                <p className='font-semibold'>{factura.vendedor || '-'}</p>
              </div>
              <div>
                <p className='text-sm text-muted-foreground mb-1'>Forma Pago</p>
                <p className='font-semibold'>{factura.forma_pago}</p>
              </div>
              <div>
                <p className='text-sm text-muted-foreground mb-1'>Plazo (días)</p>
                <p className='font-semibold'>{factura.plazo_pago}</p>
              </div>
              <div>
                <p className='text-sm text-muted-foreground mb-1'>Tasa USD</p>
                <p className='font-semibold'>{factura.tasa_us}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className='mb-6'>
          <CardHeader>
            <CardTitle>Líneas de Detalle</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='rounded border overflow-hidden'>
              <Table>
                <TableHeader className='bg-muted/50'>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className='text-right'>Cantidad</TableHead>
                    <TableHead className='text-right'>Precio</TableHead>
                    <TableHead className='text-right'>Subtotal</TableHead>
                    <TableHead className='text-right'>Impuesto</TableHead>
                    <TableHead className='text-right'>Neto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {factura.lineas && factura.lineas.length > 0 ? (
                    factura.lineas.map((linea) => (
                      <TableRow key={linea.no_linea}>
                        <TableCell>{linea.no_linea}</TableCell>
                        <TableCell className='font-mono'>{linea.no_produ}</TableCell>
                        <TableCell>{linea.descripcion || '-'}</TableCell>
                        <TableCell className='text-right'>
                          {linea.cantidad.toFixed(2)}
                        </TableCell>
                        <TableCell className='text-right'>
                          {linea.precio.toFixed(2)}
                        </TableCell>
                        <TableCell className='text-right'>
                          {(linea.cantidad * linea.precio).toFixed(2)}
                        </TableCell>
                        <TableCell className='text-right'>
                          {linea.impuesto.toFixed(2)}
                        </TableCell>
                        <TableCell className='text-right font-semibold'>
                          {linea.monto_neto.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className='text-center py-4 text-muted-foreground'>
                        Sin líneas
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className='mb-6'>
          <CardHeader>
            <CardTitle>Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-2 max-w-sm ml-auto'>
              <div className='flex justify-between text-sm'>
                <span>Total Línea:</span>
                <span className='font-mono'>{factura.total_linea.toFixed(2)}</span>
              </div>
              <div className='flex justify-between text-sm'>
                <span>Descuento:</span>
                <span className='font-mono'>-{factura.descuento.toFixed(2)}</span>
              </div>
              <div className='flex justify-between text-sm'>
                <span>Impuesto:</span>
                <span className='font-mono'>{factura.impuesto.toFixed(2)}</span>
              </div>
              <div className='border-t pt-2 flex justify-between font-bold'>
                <span>Total Neto:</span>
                <span className='font-mono'>{factura.total_neto.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className='flex gap-2 mb-6'>
          <Button variant='outline' onClick={onBack}>
            <ArrowLeft className='h-4 w-4 mr-2' /> Volver
          </Button>

          <Button
            variant='secondary'
            size='sm'
            onClick={() => {
              const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || '/api'
              const qs = new URLSearchParams({ no_cia: factura.no_cia, punto: factura.punto })
              window.open(`${apiBase}/fat/documentos/${factura.tipo_factura}/${factura.no_factura}/pdf/?${qs}`, '_blank')
            }}
          >
            <Printer className='size-4 mr-2' />
            Imprimir / PDF
          </Button>

          {factura.estado === 'P' && (
            <>
              <Button onClick={() => onEdit(factura)} variant='outline'>
                Editar
              </Button>
              <Button
                onClick={handleGenerar}
                disabled={actionsLoading}
              >
                {actionsLoading && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
                <CheckCircle className='h-4 w-4 mr-2' /> Autorizar
              </Button>
            </>
          )}

          {factura.estado === 'A' && (
            <>
              <Button
                onClick={handleImprimir}
                disabled={actionsLoading}
                variant='outline'
              >
                {actionsLoading && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
                <Printer className='h-4 w-4 mr-2' /> Imprimir
              </Button>
              <Button
                onClick={handleAnular}
                disabled={actionsLoading}
                variant='destructive'
              >
                {actionsLoading && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
                <XCircle className='h-4 w-4 mr-2' /> Anular
              </Button>
            </>
          )}
        </div>
      </Main>
    </>
  )
}
