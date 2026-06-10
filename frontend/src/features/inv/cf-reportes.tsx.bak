import { useEffect, useState } from 'react'
import { FileDown, Printer, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

interface Props {
  noCia: string
  punto: string
}

export function ConteoFisicoReportes({ noCia, punto }: Props) {
  const [almacen, setAlmacen] = useState('')
  const [grupo, setGrupo] = useState('')
  const [linea, setLinea] = useState('')
  const [sublinea, setSublinea] = useState('')
  const [codProducto, setCodProducto] = useState('')
  const [tipoProd, setTipoProd] = useState('')
  const [soloConExistencia, setSoloConExistencia] = useState(false)

  const [almacenes, setAlmacenes] = useState<any[]>([])
  const [grupos, setGrupos] = useState<any[]>([])
  const [lineas, setLineas] = useState<any[]>([])

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [cancelResult, setCancelResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    if (!noCia) return
    apiFetch<any>(`/inv/almacenes/?no_cia=${noCia}`)
      .then((d) => setAlmacenes(Array.isArray(d) ? d : d.items ?? d.results ?? []))
      .catch(() => {})
    apiFetch<any>(`/inv/grupos/?no_cia=${noCia}`)
      .then((d) => setGrupos(Array.isArray(d) ? d : d.items ?? d.results ?? []))
      .catch(() => {})
    apiFetch<any>(`/inv/lineas/?no_cia=${noCia}`)
      .then((d) => setLineas(Array.isArray(d) ? d : d.items ?? d.results ?? []))
      .catch(() => {})
  }, [noCia])

  function buildQs() {
    const qs = new URLSearchParams({ no_cia: noCia, punto })
    if (almacen) qs.set('almacen', almacen)
    if (grupo) qs.set('grupo', grupo)
    if (linea) qs.set('linea', linea)
    if (sublinea) qs.set('sublinea', sublinea)
    if (codProducto) qs.set('no_produ', codProducto)
    if (tipoProd) qs.set('tipo_prod', tipoProd)
    qs.set('con_existencia', soloConExistencia ? '1' : '0')
    return qs.toString()
  }

  function handlePdf() {
    window.open(`${API_BASE}/inv/conteo-fisico/reporte-pdf/?${buildQs()}`, '_blank')
  }

  function handleExcel() {
    window.open(`${API_BASE}/inv/conteo-fisico/excel/?${buildQs()}`, '_blank')
  }

  async function handleCancelar() {
    setCanceling(true)
    setCancelResult(null)
    try {
      const res = await fetch(`${API_BASE}/inv/conteo-fisico/cancelar/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_cia: noCia, punto, almacen, grupo, linea }),
      })
      if (res.ok) {
        setCancelResult({ ok: true, msg: 'Conteo físico cancelado exitosamente.' })
      } else {
        const err = await res.json().catch(() => ({}))
        setCancelResult({ ok: false, msg: err?.detail ?? `Error HTTP ${res.status}` })
      }
    } catch {
      setCancelResult({ ok: false, msg: 'No se pudo conectar con el servidor.' })
    } finally {
      setCanceling(false)
    }
  }

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-lg font-semibold'>Reportes Para Conteo Físico</h2>
        <p className='text-sm text-muted-foreground'>
          FINV708 — Genera reportes Rinv701 / Rinv708. Permite también cancelar el proceso de conteo.
        </p>
      </div>

      <div className='rounded-md border p-5 bg-muted/20 space-y-5'>
        {/* Filtros */}
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
          <div className='space-y-1.5'>
            <Label>Almacén</Label>
            <Select value={almacen || '__all__'} onValueChange={(v) => setAlmacen(v === '__all__' ? '' : v)}>
              <SelectTrigger className='h-9'><SelectValue placeholder='Todos los almacenes' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='__all__'>Todos los almacenes</SelectItem>
                {almacenes.map((a: any) => {
                  const key = a.almacen ?? a.codigo ?? a.id
                  return (
                    <SelectItem key={key} value={String(key)}>
                      {a.descripcion ?? a.desc_almacen ?? key}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-1.5'>
            <Label>Grupo</Label>
            <Select value={grupo || '__all__'} onValueChange={(v) => setGrupo(v === '__all__' ? '' : v)}>
              <SelectTrigger className='h-9'><SelectValue placeholder='Todos los grupos' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='__all__'>Todos los grupos</SelectItem>
                {grupos.map((g: any) => {
                  const key = g.grupo ?? g.codigo ?? g.id
                  return (
                    <SelectItem key={key} value={String(key)}>
                      {g.descripcion ?? key}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-1.5'>
            <Label>Línea</Label>
            <Select value={linea || '__all__'} onValueChange={(v) => setLinea(v === '__all__' ? '' : v)}>
              <SelectTrigger className='h-9'><SelectValue placeholder='Todas las líneas' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='__all__'>Todas las líneas</SelectItem>
                {lineas.map((l: any) => {
                  const key = l.linea ?? l.codigo ?? l.id
                  return (
                    <SelectItem key={key} value={String(key)}>
                      {l.descripcion ?? key}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-1.5'>
            <Label>Sublínea</Label>
            <Input
              className='h-9'
              placeholder='Código sublínea'
              value={sublinea}
              onChange={(e) => setSublinea(e.target.value)}
            />
          </div>

          <div className='space-y-1.5'>
            <Label>Código Producto</Label>
            <Input
              className='h-9'
              placeholder='Ej: 00000001'
              value={codProducto}
              onChange={(e) => setCodProducto(e.target.value)}
            />
          </div>

          <div className='space-y-1.5'>
            <Label>Tipo de Producto</Label>
            <Select value={tipoProd || '__all__'} onValueChange={(v) => setTipoProd(v === '__all__' ? '' : v)}>
              <SelectTrigger className='h-9'><SelectValue placeholder='Todos los tipos' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='__all__'>Todos los tipos</SelectItem>
                <SelectItem value='N'>Normal</SelectItem>
                <SelectItem value='S'>Servicio</SelectItem>
                <SelectItem value='K'>Kit / Ensamble</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='flex items-center gap-3 pt-5'>
            <Switch
              id='con-existencia'
              checked={soloConExistencia}
              onCheckedChange={setSoloConExistencia}
            />
            <Label htmlFor='con-existencia'>Solo con existencia</Label>
          </div>
        </div>

        {/* Botones de acción */}
        <div className='flex flex-wrap gap-3 pt-2 border-t'>
          <Button className='gap-2' onClick={handlePdf}>
            <Printer className='h-4 w-4' />
            Reporte PDF
          </Button>
          <Button variant='outline' className='gap-2' onClick={handleExcel}>
            <FileDown className='h-4 w-4' />
            Excel
          </Button>
          <Button
            variant='destructive'
            className='gap-2'
            onClick={() => { setCancelResult(null); setCancelDialogOpen(true) }}
          >
            <XCircle className='h-4 w-4' />
            Cancelar Conteo Físico
          </Button>
        </div>
      </div>

      {/* Dialog confirmación cancelar */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar cancelación de conteo físico</DialogTitle>
            <DialogDescription>
              Esta acción cancelará el proceso de conteo físico activo para los filtros seleccionados.
              Los datos capturados serán eliminados. ¿Desea continuar?
            </DialogDescription>
          </DialogHeader>

          {cancelResult && (
            <Badge variant={cancelResult.ok ? 'outline' : 'destructive'} className='text-xs'>
              {cancelResult.msg}
            </Badge>
          )}

          <DialogFooter>
            <Button variant='outline' onClick={() => setCancelDialogOpen(false)} disabled={canceling}>
              No, volver
            </Button>
            <Button
              variant='destructive'
              disabled={canceling || cancelResult?.ok === true}
              onClick={handleCancelar}
            >
              {canceling ? 'Cancelando...' : 'Sí, cancelar conteo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
