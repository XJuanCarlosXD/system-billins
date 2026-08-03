import { useState, useEffect } from 'react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { useCurrentUsername } from '@/hooks/use-me'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { GuardedButton } from '@/components/access'

interface Props {
  noCia: string
  punto: string
}

interface TipoDoc {
  tipo_docu: string
  descripcion: string
  tipo_transaccion: string
}

interface FacturaLinea {
  no_produ: string
  descripcion: string
  cantidad: number
  precio: number
  monto: number
}

interface FacturaData {
  no_factura: string
  tipo_factura: string
  fecha: string
  tasa_us: number
  total_neto: number
  saldo?: number
  no_conduce?: string
  no_cliente: string
  nombre_cliente?: string
  lineas: FacturaLinea[]
}

const fmtN = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const mesAnioActual = () => {
  const d = new Date()
  const meses = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ]
  return `${meses[d.getMonth()]} ${d.getFullYear()}`
}

export function AnularFactura({ noCia, punto }: Props) {
  const { toast } = useToast()
  const currentUser = useCurrentUsername()

  const [tiposDoc, setTiposDoc] = useState<TipoDoc[]>([])
  const [tipoDoc, setTipoDoc] = useState('')
  const [noDoc, setNoDoc] = useState('')
  const [buscando, setBuscando] = useState(false)

  const [factura, setFactura] = useState<FacturaData | null>(null)
  const [noEncontrado, setNoEncontrado] = useState(false)

  const [tipoAnulacionDGII, setTipoAnulacionDGII] = useState('')
  const [liberarNcf, setLiberarNcf] = useState(false)
  const [motivo, setMotivo] = useState('')

  const [anulando, setAnulando] = useState(false)
  const [anulado, setAnulado] = useState(false)

  const fechaHoy = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    async function cargarTipos() {
      try {
        const res = await regalGeneralApi.fatListDocumentTypes(noCia, punto)
        setTiposDoc(res.items || [])
      } catch {
        toast({
          title: 'Error',
          description: 'Error cargando tipos de documento',
          variant: 'destructive',
        })
      }
    }
    cargarTipos()
  }, [noCia, punto])

  const buscar = async () => {
    if (!tipoDoc) {
      toast({
        title: 'Validacion',
        description: 'Ingrese el tipo de documento',
        variant: 'destructive',
      })
      return
    }
    if (!noDoc.trim()) {
      toast({
        title: 'Validacion',
        description: 'Ingrese el numero de documento',
        variant: 'destructive',
      })
      return
    }
    setBuscando(true)
    setFactura(null)
    setNoEncontrado(false)
    setAnulado(false)
    setMotivo('')
    setTipoAnulacionDGII('')
    setLiberarNcf(false)
    try {
      const res = await regalGeneralApi.fatGetFactura(
        noCia,
        punto,
        tipoDoc,
        noDoc.trim().toUpperCase()
      )
      if (res) {
        setFactura(res)
        setNoEncontrado(false)
      } else {
        setNoEncontrado(true)
      }
    } catch {
      setNoEncontrado(true)
      toast({
        title: 'No encontrado',
        description: `Documento ${tipoDoc} ${noDoc} no encontrado`,
        variant: 'destructive',
      })
    } finally {
      setBuscando(false)
    }
  }

  const anularDocumento = async () => {
    if (!factura) return
    if (!motivo.trim()) {
      toast({
        title: 'Validacion',
        description: 'El detalle de anulacion es requerido',
        variant: 'destructive',
      })
      return
    }
    setAnulando(true)
    try {
      await regalGeneralApi.fatAnularFactura({
        no_cia: noCia,
        punto,
        tipo_factura: tipoDoc,
        no_factura: noDoc.trim().toUpperCase(),
        usuario: currentUser,
        motivo: motivo.trim(),
        liberar_ncf: liberarNcf,
      })
      toast({
        title: 'Documento Anulado',
        description: `Documento ${tipoDoc} ${noDoc} anulado exitosamente`,
      })
      setAnulado(true)
    } catch {
      toast({
        title: 'Error',
        description: 'Error al anular el documento',
        variant: 'destructive',
      })
    } finally {
      setAnulando(false)
    }
  }

  const anularOtro = () => {
    setFactura(null)
    setTipoDoc('')
    setNoDoc('')
    setMotivo('')
    setTipoAnulacionDGII('')
    setLiberarNcf(false)
    setAnulado(false)
    setNoEncontrado(false)
  }

  return (
    <div className='space-y-4 p-4'>
      <div className='border-b pb-2'>
        <h1 className='text-xl font-bold'>Anulacion de Documentos</h1>
        <div className='mt-1 flex gap-6 text-sm text-gray-600'>
          <span>
            No Cia: <strong>{noCia}</strong>
          </span>
          <span>
            Punto Facturacion: <strong>{punto}</strong>
          </span>
          <span>
            Mes y Anio en Proceso: <strong>{mesAnioActual()}</strong>
          </span>
        </div>
      </div>

      <div className='space-y-3 rounded-md border p-4'>
        <h2 className='text-sm font-semibold text-gray-700 uppercase'>
          Buscar Documento
        </h2>
        <div className='grid grid-cols-4 items-end gap-3'>
          <div className='space-y-1'>
            <Label>Tipo Documento</Label>
            <Select value={tipoDoc} onValueChange={setTipoDoc}>
              <SelectTrigger>
                <SelectValue placeholder='Seleccionar...' />
              </SelectTrigger>
              <SelectContent>
                {tiposDoc.map((d) => (
                  <SelectItem key={d.tipo_docu} value={d.tipo_docu}>
                    {d.tipo_docu} - {d.descripcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1'>
            <Label>No. Documento</Label>
            <Input
              value={noDoc}
              onChange={(e) => setNoDoc(e.target.value.toUpperCase())}
              placeholder='Numero de documento'
              onKeyDown={(e) => {
                if (e.key === 'Enter') buscar()
              }}
            />
          </div>
          <div>
            <Button onClick={buscar} disabled={buscando} className='w-full'>
              {buscando ? 'Buscando...' : 'BUSCAR'}
            </Button>
          </div>
        </div>

        {noEncontrado && (
          <div className='rounded border border-red-300 bg-red-50 p-2 text-sm text-red-600'>
            Documento no encontrado. Verifique el tipo y numero de documento.
          </div>
        )}
      </div>

      {factura && (
        <>
          <div className='space-y-3 rounded-md border p-4'>
            <div className='flex items-center justify-between'>
              <h2 className='text-sm font-semibold text-gray-700 uppercase'>
                Datos del Documento
              </h2>
              {anulado && (
                <Badge variant='destructive' className='px-3 py-1 text-sm'>
                  ANULADO
                </Badge>
              )}
            </div>

            <div className='grid grid-cols-4 gap-3'>
              <div className='space-y-1'>
                <Label>Fecha Doc.</Label>
                <Input
                  value={factura.fecha}
                  readOnly
                  className='bg-background'
                />
              </div>
              <div className='space-y-1'>
                <Label>Tasa Us</Label>
                <Input
                  value={fmtN(factura.tasa_us)}
                  readOnly
                  className='bg-background font-mono'
                />
              </div>
              <div className='space-y-1'>
                <Label>Fecha Anulacion</Label>
                <Input value={fechaHoy} readOnly className='bg-background' />
              </div>
              <div className='space-y-1'>
                <Label>No. Cliente</Label>
                <Input
                  value={factura.no_cliente}
                  readOnly
                  className='bg-background font-mono'
                />
              </div>
            </div>

            <div className='grid grid-cols-4 gap-3'>
              <div className='space-y-1'>
                <Label>Tipo AF (Docu. Anulacion)</Label>
                <Input
                  placeholder='Tipo'
                  maxLength={4}
                  className='font-mono'
                  readOnly
                />
              </div>
              <div className='space-y-1'>
                <Label>No. Docu. Anulacion</Label>
                <Input
                  placeholder='Auto'
                  readOnly
                  className='bg-background font-mono'
                />
              </div>
              <div className='space-y-1'>
                <Label>Valor Documento</Label>
                <Input
                  value={fmtN(factura.total_neto)}
                  readOnly
                  className='bg-background text-right font-mono'
                />
              </div>
              <div className='space-y-1'>
                <Label>Saldo</Label>
                <Input
                  value={fmtN(factura.saldo ?? factura.total_neto)}
                  readOnly
                  className='bg-background text-right font-mono'
                />
              </div>
            </div>

            <div className='grid grid-cols-4 gap-3'>
              <div className='space-y-1'>
                <Label>Conduce Relacionado</Label>
                <Input
                  value={factura.no_conduce || ''}
                  readOnly
                  className='bg-background font-mono'
                />
              </div>
              <div className='space-y-1'>
                <Label>Tipo Anulacion DGII</Label>
                <Input
                  value={tipoAnulacionDGII}
                  onChange={(e) => setTipoAnulacionDGII(e.target.value)}
                  placeholder='Cod.'
                  maxLength={4}
                  disabled={anulado}
                />
              </div>
              <div className='flex items-end gap-2 space-y-1 pb-1'>
                <Checkbox
                  id='liberar-ncf'
                  checked={liberarNcf}
                  onCheckedChange={(v) => setLiberarNcf(v === true)}
                  disabled={anulado}
                />
                <Label htmlFor='liberar-ncf'>Liberar NCF</Label>
              </div>
            </div>

            <div className='space-y-1'>
              <Label>
                Detalle Anulacion <span className='text-red-500'>*</span>
              </Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder='Indique el motivo de la anulacion...'
                rows={3}
                className='resize-none'
                disabled={anulado}
              />
            </div>
          </div>

          <div className='space-y-3 rounded-md border p-4'>
            <h2 className='text-sm font-semibold text-gray-700 uppercase'>
              Vista Previa del Documento — {factura.tipo_factura}{' '}
              {factura.no_factura}
            </h2>
            <div className='flex gap-6 text-sm text-gray-700'>
              <span>
                Cliente: <strong>{factura.no_cliente}</strong>
                {factura.nombre_cliente ? ` — ${factura.nombre_cliente}` : ''}
              </span>
              <span>
                Fecha: <strong>{factura.fecha}</strong>
              </span>
              <span>
                Total:{' '}
                <strong className='font-mono'>
                  {fmtN(factura.total_neto)}
                </strong>
              </span>
            </div>
            <div className='overflow-x-auto rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-28'>No Prod</TableHead>
                    <TableHead>Descripcion</TableHead>
                    <TableHead className='w-20 text-right'>Cantidad</TableHead>
                    <TableHead className='w-24 text-right'>Precio</TableHead>
                    <TableHead className='w-28 text-right'>Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!factura.lineas || factura.lineas.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className='py-4 text-center text-gray-400'
                      >
                        Sin lineas de detalle
                      </TableCell>
                    </TableRow>
                  )}
                  {(factura.lineas || []).map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className='font-mono text-sm'>
                        {l.no_produ}
                      </TableCell>
                      <TableCell>{l.descripcion}</TableCell>
                      <TableCell className='text-right font-mono text-sm'>
                        {fmtN(l.cantidad)}
                      </TableCell>
                      <TableCell className='text-right font-mono text-sm'>
                        {fmtN(l.precio)}
                      </TableCell>
                      <TableCell className='text-right font-mono text-sm'>
                        {fmtN(l.monto)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className='border-t-2 font-bold'>
                    <TableCell colSpan={4} className='text-right'>
                      Total Neto:
                    </TableCell>
                    <TableCell className='text-right font-mono'>
                      {fmtN(factura.total_neto)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div className='flex items-center gap-3'>
            {!anulado ? (
              <GuardedButton
                modulo='fat'
                docType='AF'
                noCia={noCia}
                punto={punto}
                variant='destructive'
                size='lg'
                onClick={anularDocumento}
                disabled={anulando || !motivo.trim()}
                className='px-8'
              >
                {anulando ? 'Anulando...' : 'ANULAR DOCUMENTO'}
              </GuardedButton>
            ) : (
              <>
                <Badge variant='destructive' className='px-4 py-2 text-sm'>
                  Documento {tipoDoc} {noDoc} anulado exitosamente
                </Badge>
                <Button variant='outline' onClick={anularOtro}>
                  Anular Otro Documento
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
