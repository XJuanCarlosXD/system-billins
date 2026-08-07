import { useEffect, useState } from 'react'
import { RotateCcw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { GuardedButton } from '@/components/access'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface Props { noCia: string; punto: string }

interface TipoDocu {
  tipo_docu?: string
  tipo_doc?: string
  descripcion?: string
  [key: string]: any
}

interface DocumentoInfo {
  tipo_movi?: string
  tipo_transaccion?: string
  almacen?: string
  entrada_almacen?: string
  fecha_doc?: string
  fecha?: string
  estado?: string
  st_anulado?: string
  tipo_docu_rev?: string
  no_docu_rev?: string
  total_neto?: number
  [key: string]: any
}

const csrfToken = () =>
  (document.cookie.split('; ').find((c) => c.startsWith('csrftoken=')) || '').split('=')[1] || ''

const fmt = (v: unknown) =>
  Number(v ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// NO_DOCU en INV es CHAR(7): "137" → "0000137"
const normNoDocu = (v: string) => {
  const n = v.trim()
  return /^\d+$/.test(n) ? n.padStart(7, '0') : n
}

export function ReverarDocumento({ noCia, punto }: Props) {
  const [tipoDocu, setTipoDocu] = useState('')
  const [noDocu, setNoDocu] = useState('')
  const [tiposDocu, setTiposDocu] = useState<TipoDocu[]>([])
  const [doc, setDoc] = useState<DocumentoInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [motivo, setMotivo] = useState('')

  const tipoKey = (t: TipoDocu) => String(t.tipo_docu ?? t.tipo_doc ?? '')

  useEffect(() => {
    if (!noCia) return
    // Reversar puede aplicar a cualquier tipo de documento -> se listan todos.
    fetch(`${API_BASE}/inv/tipos-docu/?no_cia=${encodeURIComponent(noCia)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const items: TipoDocu[] = Array.isArray(data) ? data : (data.results ?? data.items ?? [])
        setTiposDocu(items)
      })
      .catch(() => setTiposDocu([]))
  }, [noCia])

  const buscar = async () => {
    if (!tipoDocu || !noDocu.trim()) {
      toast.error('Tipo y No. de documento son requeridos')
      return
    }
    if (!punto) {
      toast.error('Seleccione un punto de trabajo')
      return
    }
    const nd = normNoDocu(noDocu)
    setNoDocu(nd)
    setBusy(true)
    setDoc(null)
    try {
      const res = await fetch(
        `${API_BASE}/inv/documentos/${encodeURIComponent(tipoDocu)}/${nd}/?no_cia=${noCia}&punto=${punto}`,
        { credentials: 'include' },
      )
      if (!res.ok) {
        toast.error(res.status === 404
          ? `No existe el documento ${tipoDocu}-${nd} en este punto.`
          : `Error ${res.status}`)
        return
      }
      setDoc(await res.json())
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al buscar documento')
    } finally {
      setBusy(false)
    }
  }

  const reversar = async () => {
    if (!doc) return
    if (!motivo.trim()) {
      toast.error('El motivo de la reversión es requerido')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/inv/movimientos/reversar/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
        body: JSON.stringify({
          no_cia: noCia,
          punto,
          tipo_docu: tipoDocu,
          no_docu: normNoDocu(noDocu),
          motivo: motivo.trim(),
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.detail ?? e.error ?? `HTTP ${res.status}`)
      }
      const result = await res.json().catch(() => ({}))
      const nuevo = result.nuevo_documento || result.no_docu_rev
      toast.success(`Documento ${tipoDocu}-${normNoDocu(noDocu)} reversado${nuevo ? ` — generó ${nuevo}` : ''}`)
      setDoc(null)
      setNoDocu('')
      setMotivo('')
      setConfirming(false)
    } catch (err: any) {
      toast.error(err?.message ?? 'No se pudo reversar el documento')
    } finally {
      setBusy(false)
    }
  }

  const yaReversado = !!doc && (String(doc.st_anulado ?? '').toUpperCase() === 'S' || !!(doc.no_docu_rev && String(doc.no_docu_rev).trim()))

  return (
    <div className='space-y-4 p-4 md:p-6'>
      <div>
        <h1 className='text-2xl font-semibold flex items-center gap-2'>
          <RotateCcw className='h-5 w-5 text-primary' />
          Reversar Documento
        </h1>
        <p className='text-sm text-muted-foreground'>
          Busca un documento de inventario aplicado y reviértelo. El sistema
          genera automáticamente el movimiento inverso que lo contrarresta.
        </p>
      </div>

      {/* Búsqueda */}
      <Card>
        <CardContent className='flex flex-wrap items-end gap-3 pt-6'>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>Tipo</Label>
            <Select value={tipoDocu} onValueChange={setTipoDocu}>
              <SelectTrigger className='h-9 w-64'>
                <SelectValue placeholder='Tipo…' />
              </SelectTrigger>
              <SelectContent>
                {tiposDocu.map((t) => (
                  <SelectItem key={tipoKey(t)} value={tipoKey(t)}>
                    {tipoKey(t)} — {t.descripcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>No. Documento</Label>
            <Input
              value={noDocu}
              onChange={(e) => setNoDocu(e.target.value.replace(/[^0-9]/g, '').slice(0, 7))}
              onKeyDown={(e) => e.key === 'Enter' && buscar()}
              className='h-9 w-40 font-mono'
              inputMode='numeric'
              maxLength={7}
              placeholder='ej. 137'
            />
          </div>
          <Button onClick={buscar} size='sm' variant='outline' disabled={busy}>
            <Search className='mr-2 h-4 w-4' />
            {busy ? 'Buscando…' : 'Buscar'}
          </Button>
        </CardContent>
      </Card>

      {/* Info del documento */}
      {doc && (
        <Card>
          <CardContent className='space-y-3 pt-6'>
            <div className='grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 md:grid-cols-3'>
              <div><b>Tipo Movimiento:</b> <span className='font-mono'>{doc.tipo_movi || '—'}</span></div>
              <div><b>Tipo Transacción:</b> {doc.tipo_transaccion || '—'}</div>
              <div><b>Almacén:</b> <span className='font-mono'>{doc.almacen || doc.entrada_almacen || '—'}</span></div>
              <div><b>Fecha:</b> <span className='tabular-nums'>{(doc.fecha ?? doc.fecha_doc ?? '').slice(0, 10) || '—'}</span></div>
              <div><b>Total:</b> <span className='font-mono tabular-nums'>RD$ {fmt(doc.total_neto)}</span></div>
              <div>
                <b>Estado:</b>{' '}
                {yaReversado
                  ? <Badge variant='destructive'>Reversado / Anulado</Badge>
                  : <Badge>Activo</Badge>}
              </div>
            </div>
            <div className='flex justify-end'>
              <GuardedButton
                modulo='inv'
                flag='HACER_AJUSTES'
                noCia={noCia}
                punto={punto}
                variant='destructive'
                onClick={() => setConfirming(true)}
                disabled={busy || yaReversado}
              >
                <RotateCcw className='mr-2 h-4 w-4' />
                Reversar
              </GuardedButton>
            </div>
            {yaReversado && (
              <p className='text-right text-xs text-muted-foreground'>
                Este documento ya fue reversado/anulado y no puede reversarse de nuevo.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirmación con motivo */}
      <Dialog open={confirming} onOpenChange={(o) => !busy && setConfirming(o)}>
        <DialogContent className='h-auto max-h-[80vh] max-w-md overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Reversar {tipoDocu}-{normNoDocu(noDocu)}</DialogTitle>
          </DialogHeader>
          <div className='space-y-3'>
            <p className='text-sm text-muted-foreground'>
              El documento quedará reversado y se generará automáticamente el
              movimiento inverso que contrarresta su efecto en el inventario.
              Esta operación no puede deshacerse.
            </p>
            <div className='min-w-0 space-y-1'>
              <Label className='text-xs'>
                Motivo de la reversión <span className='text-destructive'>*</span>
              </Label>
              <Input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value.slice(0, 60))}
                placeholder='ej. digitado con almacén equivocado'
                maxLength={60}
                autoFocus
              />
            </div>
            <div className='flex justify-end gap-2 pt-2'>
              <Button variant='outline' onClick={() => setConfirming(false)} disabled={busy}>
                Cancelar
              </Button>
              <Button variant='destructive' onClick={reversar} disabled={busy || !motivo.trim()}>
                <RotateCcw className='mr-2 h-4 w-4' />
                {busy ? 'Reversando…' : 'Confirmar Reverso'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
