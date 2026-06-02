import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface Props { noCia: string; punto: string }

interface DocumentoInfo {
  tipo_movi?: string
  tipo_transaccion?: string
  entrada_almacen?: string
  fecha_doc?: string
  [key: string]: any
}

const MESES = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
]

const now = new Date()
const padZ = (n: number) => String(n).padStart(2, '0')

export function ReverarDocumento({ noCia, punto }: Props) {
  // Search parameters
  const [mes, setMes] = useState(padZ(now.getMonth() + 1))
  const [anio, setAnio] = useState(String(now.getFullYear()))
  const [puntoTrabajo, setPuntoTrabajo] = useState(punto || '')
  const [tipoDocuOrig, setTipoDocuOrig] = useState('')
  const [noDocumento, setNoDocumento] = useState('')

  // Found document info
  const [docInfo, setDocInfo] = useState<DocumentoInfo | null>(null)
  const [loadingDoc, setLoadingDoc] = useState(false)

  // Reversal fields
  const [tipoDocRev, setTipoDocRev] = useState('')
  const [tipoMoviRev, setTipoMoviRev] = useState('')
  const [fechaNueva, setFechaNueva] = useState(new Date().toISOString().slice(0, 10))
  const [nuevoDocumento, setNuevoDocumento] = useState('')
  const [motivo, setMotivo] = useState('')

  // UI state
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [reversing, setReversing] = useState(false)

  const buscarDocumento = async () => {
    if (!tipoDocuOrig || !noDocumento) {
      toast.error('Ingrese el Tipo de Documento y el Número de Documento a buscar')
      return
    }
    setLoadingDoc(true)
    setDocInfo(null)
    try {
      const noDocuPad = String(noDocumento).padStart(7, '0')
      const res = await fetch(
        `${API_BASE}/inv/documentos/${encodeURIComponent(tipoDocuOrig)}/${noDocuPad}/?no_cia=${noCia}&punto=${puntoTrabajo}`,
        { credentials: 'include' },
      )
      if (!res.ok) {
        if (res.status === 404) {
          toast.error('Documento no encontrado')
        } else {
          throw new Error(`HTTP ${res.status}`)
        }
        return
      }
      const data = await res.json()
      setDocInfo(data)
    } catch (err: any) {
      toast.error(`Error al buscar documento: ${err.message ?? 'Error desconocido'}`)
    } finally {
      setLoadingDoc(false)
    }
  }

  const handleReversar = async () => {
    if (!motivo.trim()) {
      toast.error('El motivo de reversión es requerido')
      return
    }
    setReversing(true)
    setConfirmOpen(false)
    try {
      const payload = {
        no_cia: noCia,
        punto: puntoTrabajo,
        tipo_docu: tipoDocuOrig,
        no_docu: noDocumento,
        motivo,
      }
      const csrf = (document.cookie.split('; ').find(c => c.startsWith('csrftoken=')) || '').split('=')[1] || ''
      const res = await fetch(`${API_BASE}/inv/movimientos/reversar/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail ?? errData.error ?? `HTTP ${res.status}`)
      }
      const result = await res.json()
      toast.success(`Reversión aplicada correctamente. Nuevo doc: ${result.nuevo_documento ?? nuevoDocumento}`)
      // Reset
      setDocInfo(null)
      setNoDocumento('')
      setTipoDocuOrig('')
      setTipoDocRev('')
      setTipoMoviRev('')
      setNuevoDocumento('')
      setMotivo('')
    } catch (err: any) {
      toast.error(`Error al reversar: ${err.message ?? 'Error desconocido'}`)
    } finally {
      setReversing(false)
    }
  }

  const isEndpointReady = true // POST /api/inv/movimientos/reversar/

  return (
    <>
      <section className='space-y-6'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <RotateCcw className='h-5 w-5 text-primary' />
            Reversar Documento de Movimiento Interno
          </h2>
          <p className='text-sm text-muted-foreground'>FINV214 — Revertir un movimiento de inventario aplicado</p>
        </div>

        {/* Document search */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Documento a Reversar</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
              <div className='space-y-1'>
                <Label>Mes en Proceso</Label>
                <Select value={mes} onValueChange={setMes}>
                  <SelectTrigger className='h-9'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-1'>
                <Label htmlFor='anio-rev'>Año en Proceso</Label>
                <Input
                  id='anio-rev'
                  className='h-9'
                  type='number'
                  min={2000}
                  max={2099}
                  value={anio}
                  onChange={(e) => setAnio(e.target.value)}
                />
              </div>

              <div className='space-y-1'>
                <Label htmlFor='punto-rev'>Punto de Trabajo</Label>
                <Input
                  id='punto-rev'
                  className='h-9'
                  placeholder='Punto'
                  value={puntoTrabajo}
                  onChange={(e) => setPuntoTrabajo(e.target.value)}
                />
              </div>

              <div className='space-y-1'>
                <Label htmlFor='tipo-docu-rev'>Tipo Documento</Label>
                <Input
                  id='tipo-docu-rev'
                  className='h-9 font-mono uppercase'
                  placeholder='AE, SA, EC...'
                  maxLength={4}
                  value={tipoDocuOrig}
                  onChange={(e) => setTipoDocuOrig(e.target.value.toUpperCase())}
                />
              </div>

              <div className='space-y-1'>
                <Label htmlFor='no-documento'>No. Documento</Label>
                <Input
                  id='no-documento'
                  className='h-9 font-mono'
                  type='number'
                  min={1}
                  placeholder='Número'
                  value={noDocumento}
                  onChange={(e) => setNoDocumento(e.target.value)}
                />
              </div>
            </div>

            <Button
              variant='outline'
              size='sm'
              onClick={buscarDocumento}
              disabled={loadingDoc}
              className='gap-2'
            >
              {loadingDoc ? 'Buscando...' : 'Buscar Documento'}
            </Button>

            {/* Document info display */}
            {docInfo && (
              <div className='mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 rounded-md border bg-muted/50 p-4'>
                <div>
                  <p className='text-xs text-muted-foreground'>Tipo Movimiento</p>
                  <p className='text-sm font-medium font-mono'>{docInfo.tipo_movi ?? '—'}</p>
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>Tipo Transacción</p>
                  <p className='text-sm font-medium'>{docInfo.tipo_transaccion ?? '—'}</p>
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>Entrada Almacén</p>
                  <p className='text-sm font-medium font-mono'>{docInfo.entrada_almacen ?? '—'}</p>
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>Fecha Documento</p>
                  <p className='text-sm font-medium tabular-nums'>{docInfo.fecha_doc?.slice(0, 10) ?? '—'}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reversal parameters */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Parámetros de Reversión</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
              <div className='space-y-1'>
                <Label htmlFor='tipo-doc-rev-new'>Tipo Doc. Reversión</Label>
                <Input
                  id='tipo-doc-rev-new'
                  className='h-9 font-mono uppercase'
                  placeholder='Tipo doc.'
                  maxLength={4}
                  value={tipoDocRev}
                  onChange={(e) => setTipoDocRev(e.target.value.toUpperCase())}
                />
              </div>

              <div className='space-y-1'>
                <Label htmlFor='tipo-movi-rev'>Tipo Movimiento</Label>
                <Input
                  id='tipo-movi-rev'
                  className='h-9 font-mono uppercase'
                  placeholder='E / S'
                  maxLength={2}
                  value={tipoMoviRev}
                  onChange={(e) => setTipoMoviRev(e.target.value.toUpperCase())}
                />
              </div>

              <div className='space-y-1'>
                <Label htmlFor='fecha-nueva-rev'>Fecha Nueva</Label>
                <Input
                  id='fecha-nueva-rev'
                  type='date'
                  className='h-9'
                  value={fechaNueva}
                  onChange={(e) => setFechaNueva(e.target.value)}
                />
              </div>

              <div className='space-y-1'>
                <Label htmlFor='nuevo-documento'>Nuevo Documento No.</Label>
                <Input
                  id='nuevo-documento'
                  className='h-9 font-mono'
                  placeholder='Auto'
                  value={nuevoDocumento}
                  onChange={(e) => setNuevoDocumento(e.target.value)}
                />
              </div>
            </div>

            <div className='space-y-1'>
              <Label htmlFor='motivo-rev'>Motivo de la Reversión <span className='text-destructive'>*</span></Label>
              <Textarea
                id='motivo-rev'
                placeholder='Describa el motivo por el cual se está reversando este documento...'
                className='resize-none h-24'
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>

            <div className='flex justify-end pt-2'>
              {isEndpointReady ? (
                <Button
                  variant='destructive'
                  className='gap-2'
                  disabled={reversing || !docInfo}
                  onClick={() => setConfirmOpen(true)}
                >
                  <RotateCcw className='h-4 w-4' />
                  {reversing ? 'Reversando...' : 'Reversar Documento'}
                </Button>
              ) : (
                <Button
                  variant='destructive'
                  className='gap-2'
                  disabled
                  title='Endpoint en construcción'
                >
                  <RotateCcw className='h-4 w-4' />
                  Reversar Documento
                </Button>
              )}
            </div>

            {!isEndpointReady && (
              <p className='text-xs text-muted-foreground text-right'>
                Endpoint <code className='rounded bg-muted px-1 py-0.5'>/api/inv/reversar/</code> en construcción — el formulario está listo.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className='max-w-[70vw] max-h-[70vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Confirmar Reversión</DialogTitle>
            <DialogDescription>
              Esta acción reversará el documento <strong className='font-mono'>{tipoDocuOrig} #{noDocumento}</strong>.
              Esta operación no puede deshacerse automáticamente. ¿Desea continuar?
            </DialogDescription>
          </DialogHeader>
          {motivo && (
            <div className='rounded-md border bg-muted/50 px-4 py-3 text-sm'>
              <p className='text-xs font-medium text-muted-foreground mb-1'>Motivo:</p>
              <p>{motivo}</p>
            </div>
          )}
          <DialogFooter className='gap-2'>
            <Button variant='outline' onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant='destructive' onClick={handleReversar} disabled={reversing}>
              {reversing ? 'Reversando...' : 'Confirmar Reversión'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
