import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCurrentUsername } from '@/hooks/use-me'

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

export interface CrearProductoModalResult {
  no_produ: string
  descri: string
  costo: number
  porciento_impuesto: number
}

interface Props {
  open: boolean
  onClose: () => void
  /** Se llama tras crear el producto con éxito. El caller decide qué hacer
   * con él (seleccionarlo en una fila, en el modal de búsqueda, etc). */
  onCreated: (producto: CrearProductoModalResult) => void
  noCia: string
  /** Prefill de descripción con el texto que el usuario ya había tecleado
   * en el buscador que disparó este modal. */
  descripcionInicial?: string
}

interface CatalogItem {
  [key: string]: unknown
}

interface DefaultsClasificacion {
  linea: string
  sub_linea: string
  grupo_produ: string
  grupo_contable: string
}

function defaultsKey(usuario: string, noCia: string) {
  return `inv.crearProductoDefaults.${usuario}.${noCia}`
}

function readDefaults(
  usuario: string,
  noCia: string
): DefaultsClasificacion | null {
  if (!usuario) return null
  try {
    const raw = localStorage.getItem(defaultsKey(usuario, noCia))
    return raw ? (JSON.parse(raw) as DefaultsClasificacion) : null
  } catch {
    return null
  }
}

function saveDefaults(
  usuario: string,
  noCia: string,
  d: DefaultsClasificacion
) {
  if (!usuario) return
  try {
    localStorage.setItem(defaultsKey(usuario, noCia), JSON.stringify(d))
  } catch {
    // localStorage no disponible (modo privado, cuota llena) — no es crítico
  }
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** Distintos catálogos INV usan distintas claves para su código (grupo_produ
 * vs grupo vs codigo, etc). Este helper prueba varias en orden. */
function catalogCode(item: CatalogItem, ...keys: string[]): string {
  for (const k of keys) {
    const v = item[k]
    if (v !== undefined && v !== null && v !== '') return String(v)
  }
  return ''
}

export function CrearProductoModal({
  open,
  onClose,
  onCreated,
  noCia,
  descripcionInicial = '',
}: Props) {
  const usuario = useCurrentUsername()

  const [codigoPreview, setCodigoPreview] = useState('')
  const [loadingCodigo, setLoadingCodigo] = useState(false)

  const [descripcion, setDescripcion] = useState(descripcionInicial)
  const [linea, setLinea] = useState('')
  const [subLinea, setSubLinea] = useState('')
  const [grupoProdu, setGrupoProdu] = useState('')
  const [grupoContable, setGrupoContable] = useState('')
  const [costo, setCosto] = useState('')
  const [tieneImpuesto, setTieneImpuesto] = useState(true)
  const [porcientoImpuesto, setPorcientoImpuesto] = useState('18')

  const [lineas, setLineas] = useState<CatalogItem[]>([])
  const [sublineas, setSublineas] = useState<CatalogItem[]>([])
  const [grupos, setGrupos] = useState<CatalogItem[]>([])
  const [gruposContables, setGruposContables] = useState<CatalogItem[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Al abrir: reset del formulario, preview de código y catálogos.
  useEffect(() => {
    if (!open) return
    setDescripcion(descripcionInicial)
    setCosto('')
    setTieneImpuesto(true)
    setPorcientoImpuesto('18')
    setError('')

    setLoadingCodigo(true)
    apiFetch<{ siguiente?: string }>('/inv/productos/next-codigo/')
      .then((r) => setCodigoPreview(r.siguiente ?? ''))
      .catch(() => setCodigoPreview(''))
      .finally(() => setLoadingCodigo(false))

    apiFetch<any>(`/inv/lineas/?no_cia=${encodeURIComponent(noCia)}`)
      .then((data) =>
        setLineas(Array.isArray(data) ? data : (data.items ?? data.results ?? []))
      )
      .catch(() => setLineas([]))

    apiFetch<any>(`/inv/sublineas/?no_cia=${encodeURIComponent(noCia)}`)
      .then((data) =>
        setSublineas(Array.isArray(data) ? data : (data.items ?? data.results ?? []))
      )
      .catch(() => setSublineas([]))

    apiFetch<any>(`/inv/grupos/?no_cia=${encodeURIComponent(noCia)}`)
      .then((data) =>
        setGrupos(Array.isArray(data) ? data : (data.items ?? data.results ?? []))
      )
      .catch(() => setGrupos([]))

    apiFetch<any>(`/inv/grupos-contables/?no_cia=${encodeURIComponent(noCia)}`)
      .then((data) =>
        setGruposContables(
          Array.isArray(data) ? data : (data.items ?? data.results ?? [])
        )
      )
      .catch(() => setGruposContables([]))
  }, [open, noCia, descripcionInicial])

  // Defaults por usuario+compañía — en efecto separado para no re-disparar
  // los 5 fetches de catálogo cuando `usuario` llega después (useMe async).
  useEffect(() => {
    if (!open) return
    const defaults = readDefaults(usuario, noCia)
    setLinea(defaults?.linea ?? '')
    setSubLinea(defaults?.sub_linea ?? '')
    setGrupoProdu(defaults?.grupo_produ ?? '')
    setGrupoContable(defaults?.grupo_contable ?? '')
  }, [open, noCia, usuario])

  const sublineasFiltradas = linea
    ? sublineas.filter((s) => String(s.linea) === String(linea))
    : sublineas

  const handleCrear = async () => {
    setError('')
    if (!descripcion.trim()) return setError('La descripción es requerida')
    if (descripcion.trim().length > 40)
      return setError('La descripción supera los 40 caracteres')
    if (!linea) return setError('Seleccione la línea')
    if (!subLinea) return setError('Seleccione la sub-línea')
    if (!grupoProdu) return setError('Seleccione el grupo')
    if (!grupoContable) return setError('Seleccione el grupo contable')

    setSaving(true)
    try {
      const csrf =
        (
          document.cookie.split('; ').find((c) => c.startsWith('csrftoken=')) ||
          ''
        ).split('=')[1] || ''
      const res = await fetch(`${API_BASE}/inv/productos/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
        body: JSON.stringify({
          descripcion: descripcion.trim(),
          linea,
          sub_linea: subLinea,
          grupo_produ: grupoProdu,
          grupo_contable: grupoContable,
          costo: parseFloat(costo) || 0,
          tiene_impuesto: tieneImpuesto ? 'S' : 'N',
          porciento_impuesto: tieneImpuesto ? parseFloat(porcientoImpuesto) || 0 : 0,
          codigo_auto: 'S',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? data.detail ?? `HTTP ${res.status}`)
        return
      }
      const noProdu: string = data?.data?.no_produ ?? codigoPreview
      saveDefaults(usuario, noCia, {
        linea,
        sub_linea: subLinea,
        grupo_produ: grupoProdu,
        grupo_contable: grupoContable,
      })
      toast.success(`Producto ${noProdu} creado`)
      onCreated({
        no_produ: noProdu,
        descri: descripcion.trim(),
        costo: parseFloat(costo) || 0,
        porciento_impuesto: tieneImpuesto ? parseFloat(porcientoImpuesto) || 0 : 0,
      })
    } catch (err: any) {
      setError(err?.message ?? 'Error desconocido al crear el producto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>Crear Producto</DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-1'>
            <Label htmlFor='cp-codigo'>No. Producto</Label>
            <Input
              id='cp-codigo'
              className='h-9 font-mono'
              value={loadingCodigo ? 'Generando...' : codigoPreview}
              readOnly
              disabled
            />
            <p className='text-[11px] text-muted-foreground'>
              Código autogenerado por el sistema.
            </p>
          </div>

          <div className='space-y-1'>
            <Label htmlFor='cp-descripcion'>
              Descripción <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='cp-descripcion'
              className='h-9'
              placeholder='Nombre del producto'
              value={descripcion}
              maxLength={40}
              onChange={(e) => setDescripcion(e.target.value)}
              autoFocus
            />
            <p className='text-right text-[11px] text-muted-foreground'>
              {descripcion.length}/40
            </p>
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-1'>
              <Label htmlFor='cp-grupo'>
                Grupo <span className='text-destructive'>*</span>
              </Label>
              <Select value={grupoProdu} onValueChange={setGrupoProdu}>
                <SelectTrigger id='cp-grupo' className='h-9'>
                  <SelectValue placeholder='Seleccionar...' />
                </SelectTrigger>
                <SelectContent>
                  {grupos.map((g) => {
                    const code = catalogCode(g, 'grupo_produ', 'grupo', 'codigo')
                    return (
                      <SelectItem key={code} value={code}>
                        {code} — {String(g.descripcion ?? '')}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1'>
              <Label htmlFor='cp-gc'>
                Grupo Contable <span className='text-destructive'>*</span>
              </Label>
              <Select value={grupoContable} onValueChange={setGrupoContable}>
                <SelectTrigger id='cp-gc' className='h-9'>
                  <SelectValue placeholder='Seleccionar...' />
                </SelectTrigger>
                <SelectContent>
                  {gruposContables.map((g) => {
                    const code = catalogCode(g, 'grupo_contable', 'codigo')
                    return (
                      <SelectItem key={code} value={code}>
                        {code} — {String(g.descripcion ?? '')}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1'>
              <Label htmlFor='cp-linea'>
                Línea <span className='text-destructive'>*</span>
              </Label>
              <Select
                value={linea}
                onValueChange={(v) => {
                  setLinea(v)
                  setSubLinea('')
                }}
              >
                <SelectTrigger id='cp-linea' className='h-9'>
                  <SelectValue placeholder='Seleccionar...' />
                </SelectTrigger>
                <SelectContent>
                  {lineas.map((l) => {
                    const code = catalogCode(l, 'linea', 'codigo')
                    return (
                      <SelectItem key={code} value={code}>
                        {code} — {String(l.descripcion ?? '')}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1'>
              <Label htmlFor='cp-subl'>
                Sub-Línea <span className='text-destructive'>*</span>
              </Label>
              <Select value={subLinea} onValueChange={setSubLinea} disabled={!linea}>
                <SelectTrigger id='cp-subl' className='h-9'>
                  <SelectValue placeholder={linea ? 'Seleccionar...' : 'Elija línea primero'} />
                </SelectTrigger>
                <SelectContent>
                  {sublineasFiltradas.map((s) => {
                    const code = catalogCode(s, 'sub_linea', 'codigo')
                    return (
                      <SelectItem key={code} value={code}>
                        {code} — {String(s.descripcion ?? '')}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className='grid grid-cols-2 items-end gap-4'>
            <div className='space-y-1'>
              <Label htmlFor='cp-costo'>Costo referencial</Label>
              <Input
                id='cp-costo'
                type='number'
                min={0}
                step='0.01'
                className='h-9 text-right tabular-nums'
                placeholder='0.00'
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
              />
            </div>
            <div className='flex items-center gap-2 pb-2'>
              <Checkbox
                id='cp-itbis'
                checked={tieneImpuesto}
                onCheckedChange={(v) => setTieneImpuesto(v === true)}
              />
              <Label htmlFor='cp-itbis' className='cursor-pointer'>
                Aplica ITBIS
              </Label>
              {tieneImpuesto && (
                <Input
                  type='number'
                  min={0}
                  max={100}
                  step='0.01'
                  className='h-8 w-20 text-right tabular-nums'
                  value={porcientoImpuesto}
                  onChange={(e) => setPorcientoImpuesto(e.target.value)}
                />
              )}
            </div>
          </div>

          {error && <p className='text-sm text-destructive'>{error}</p>}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleCrear} disabled={saving || loadingCodigo}>
            {saving ? 'Creando...' : 'Crear y continuar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
