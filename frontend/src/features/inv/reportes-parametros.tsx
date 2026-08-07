import { useEffect, useState } from 'react'
import { FileDown, Printer } from 'lucide-react'
import { useCompany } from '@/context/company-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

export type ReportType =
  | 'existencia'
  | 'movimientos'
  | 'kardex'
  | 'valorizacion'
  | 'lineas-sublineas'
  | 'auxiliar'
  | 'etiquetas-masivas'
  | 'barras-documento'
  | 'etiquetas-individual'
  | 'etiquetas-monarch'
  | 'consumo-proyecto'

interface Props {
  reportType: ReportType
  noCia: string
  punto: string
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

// ─── Almacén select reutilizable ──────────────────────────────────────────────
function AlmacenSelect({
  noCia,
  value,
  onChange,
}: {
  noCia: string
  value: string
  onChange: (v: string) => void
}) {
  const [almacenes, setAlmacenes] = useState<any[]>([])
  useEffect(() => {
    if (!noCia) return
    apiFetch<any>(`/inv/almacenes/?no_cia=${noCia}`)
      .then((d) => setAlmacenes(Array.isArray(d) ? d : d.items ?? d.results ?? []))
      .catch(() => {})
  }, [noCia])
  return (
    <Select value={value || '__all__'} onValueChange={(v) => onChange(v === '__all__' ? '' : v)}>
      <SelectTrigger className='h-9'>
        <SelectValue placeholder='Todos los almacenes' />
      </SelectTrigger>
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
  )
}

// ─── Existencia ──────────────────────────────────────────────────────────────
const EXISTENCIA_MODOS = [
  { value: 'Rinv301', label: 'Detallado' },
  { value: 'Rinv302', label: 'No Detallado' },
  { value: 'Rinv307', label: 'Histórico' },
  { value: 'Rinv310', label: 'Consolidado' },
  { value: 'Rinv317', label: 'Con Ubicación' },
  { value: 'Rinv306', label: 'Comparar Min-Max' },
  { value: 'Rinv312', label: 'Por Serie' },
  { value: 'Rinv325', label: 'Consumo' },
  { value: 'Rinv328', label: 'Por Fecha Últ. Entrada/Salida' },
] as const

type ExistenciaModo = (typeof EXISTENCIA_MODOS)[number]['value']

function ReporteExistencia({ noCia }: { noCia: string }) {
  const [almacen, setAlmacen] = useState('')
  const [grupo, setGrupo] = useState('')
  const [linea, setLinea] = useState('')
  const [sublinea, setSublinea] = useState('')
  const [tipoProd, setTipoProd] = useState('')
  const [conExistencia, setConExistencia] = useState(true)
  const [modo, setModo] = useState<ExistenciaModo>('Rinv301')

  const [grupos, setGrupos] = useState<any[]>([])
  const [lineas, setLineas] = useState<any[]>([])

  useEffect(() => {
    if (!noCia) return
    apiFetch<any>(`/inv/grupos/?no_cia=${noCia}`)
      .then((d) => setGrupos(Array.isArray(d) ? d : d.items ?? d.results ?? []))
      .catch(() => {})
    apiFetch<any>(`/inv/lineas/?no_cia=${noCia}`)
      .then((d) => setLineas(Array.isArray(d) ? d : d.items ?? d.results ?? []))
      .catch(() => {})
  }, [noCia])

  function generate() {
    const qs = new URLSearchParams({ no_cia: noCia })
    if (almacen) qs.set('almacen', almacen)
    if (grupo) qs.set('grupo', grupo)
    if (linea) qs.set('linea', linea)
    if (sublinea) qs.set('sublinea', sublinea)
    if (tipoProd) qs.set('tipo_prod', tipoProd)
    qs.set('con_existencia', conExistencia ? '1' : '0')
    qs.set('modo', modo)
    window.open(`/print/inv-existencia/current?${qs}`, '_blank')
  }

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        <div className='space-y-1.5'>
          <Label>Almacén</Label>
          <AlmacenSelect noCia={noCia} value={almacen} onChange={setAlmacen} />
        </div>

        <div className='space-y-1.5'>
          <Label>Grupo</Label>
          <Select value={grupo || '__all__'} onValueChange={(v) => setGrupo(v === '__all__' ? '' : v)}>
            <SelectTrigger className='h-9'>
              <SelectValue placeholder='Todos los grupos' />
            </SelectTrigger>
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
            <SelectTrigger className='h-9'>
              <SelectValue placeholder='Todas las líneas' />
            </SelectTrigger>
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
            placeholder='Código sublínea (opcional)'
            value={sublinea}
            onChange={(e) => setSublinea(e.target.value)}
          />
        </div>

        <div className='space-y-1.5'>
          <Label>Tipo de Producto</Label>
          <Select value={tipoProd || '__all__'} onValueChange={(v) => setTipoProd(v === '__all__' ? '' : v)}>
            <SelectTrigger className='h-9'>
              <SelectValue placeholder='Todos los tipos' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='__all__'>Todos los tipos</SelectItem>
              <SelectItem value='N'>Normal</SelectItem>
              <SelectItem value='S'>Servicio</SelectItem>
              <SelectItem value='K'>Kit / Ensamble</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='flex items-center gap-2 pt-5'>
          <Checkbox
            id='con-existencia'
            checked={conExistencia}
            onCheckedChange={(v) => setConExistencia(Boolean(v))}
          />
          <Label htmlFor='con-existencia'>Solo con existencia</Label>
        </div>
      </div>

      <div className='space-y-2'>
        <Label>Tipo de Reporte</Label>
        <RadioGroup
          value={modo}
          onValueChange={(v) => setModo(v as ExistenciaModo)}
          className='grid grid-cols-2 sm:grid-cols-3 gap-3'
        >
          {EXISTENCIA_MODOS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm transition-colors
                ${modo === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
            >
              <RadioGroupItem value={opt.value} />
              <span className='leading-tight'>
                {opt.label}
                <span className='block text-xs text-muted-foreground'>{opt.value}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </div>

      <Button className='gap-2' onClick={generate}>
        <FileDown className='h-4 w-4' />
        Generar Reporte PDF
      </Button>
    </div>
  )
}

// ─── Movimientos ─────────────────────────────────────────────────────────────
function ReporteMovimientos({ noCia }: { noCia: string }) {
  const today = new Date()
  const thirtyAgo = new Date(today)
  thirtyAgo.setDate(today.getDate() - 30)

  const [almacen, setAlmacen] = useState('')
  const [grupo, setGrupo] = useState('')
  const [linea, setLinea] = useState('')
  const [noProdu, setNoProdu] = useState('')
  const [desde, setDesde] = useState(toInputDate(thirtyAgo))
  const [hasta, setHasta] = useState(toInputDate(today))
  const [tipoMov, setTipoMov] = useState('')
  const [modo, setModo] = useState<'Rinv304' | 'Rinv314'>('Rinv304')

  const [grupos, setGrupos] = useState<any[]>([])
  const [lineas, setLineas] = useState<any[]>([])

  useEffect(() => {
    if (!noCia) return
    apiFetch<any>(`/inv/grupos/?no_cia=${noCia}`)
      .then((d) => setGrupos(Array.isArray(d) ? d : d.items ?? d.results ?? []))
      .catch(() => {})
    apiFetch<any>(`/inv/lineas/?no_cia=${noCia}`)
      .then((d) => setLineas(Array.isArray(d) ? d : d.items ?? d.results ?? []))
      .catch(() => {})
  }, [noCia])

  function generate() {
    const qs = new URLSearchParams({ no_cia: noCia })
    if (almacen) qs.set('almacen', almacen)
    if (grupo) qs.set('grupo', grupo)
    if (linea) qs.set('linea', linea)
    if (noProdu) qs.set('no_produ', noProdu)
    if (desde) qs.set('desde', desde)
    if (hasta) qs.set('hasta', hasta)
    if (tipoMov) qs.set('tipo_movimiento', tipoMov)
    qs.set('modo', modo)
    window.open(`/print/inv-movimientos/current?${qs}`, '_blank')
  }

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        <div className='space-y-1.5'>
          <Label>Almacén</Label>
          <AlmacenSelect noCia={noCia} value={almacen} onChange={setAlmacen} />
        </div>

        <div className='space-y-1.5'>
          <Label>Grupo</Label>
          <Select value={grupo || '__all__'} onValueChange={(v) => setGrupo(v === '__all__' ? '' : v)}>
            <SelectTrigger className='h-9'><SelectValue placeholder='Todos los grupos' /></SelectTrigger>
            <SelectContent>
              <SelectItem value='__all__'>Todos los grupos</SelectItem>
              {grupos.map((g: any) => {
                const key = g.grupo ?? g.codigo ?? g.id
                return <SelectItem key={key} value={String(key)}>{g.descripcion ?? key}</SelectItem>
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
                return <SelectItem key={key} value={String(key)}>{l.descripcion ?? key}</SelectItem>
              })}
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-1.5'>
          <Label>Código de Producto</Label>
          <Input
            className='h-9'
            placeholder='Ej: PROD001'
            value={noProdu}
            onChange={(e) => setNoProdu(e.target.value)}
          />
        </div>

        <div className='space-y-1.5'>
          <Label>Desde</Label>
          <Input type='date' className='h-9' value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>Hasta</Label>
          <Input type='date' className='h-9' value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>Tipo de Movimiento</Label>
          <Select value={tipoMov || '__all__'} onValueChange={(v) => setTipoMov(v === '__all__' ? '' : v)}>
            <SelectTrigger className='h-9'><SelectValue placeholder='Todos los tipos' /></SelectTrigger>
            <SelectContent>
              <SelectItem value='__all__'>Todos los tipos</SelectItem>
              <SelectItem value='E'>Entradas</SelectItem>
              <SelectItem value='S'>Salidas</SelectItem>
              <SelectItem value='A'>Ajustes</SelectItem>
              <SelectItem value='T'>Transferencias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className='space-y-2'>
        <Label>Tipo de Reporte</Label>
        <RadioGroup value={modo} onValueChange={(v) => setModo(v as typeof modo)} className='flex gap-4'>
          {[
            { value: 'Rinv304', label: 'Rinv304 — Estándar' },
            { value: 'Rinv314', label: 'Rinv314 — Extendido' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm transition-colors
                ${modo === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
            >
              <RadioGroupItem value={opt.value} />
              {opt.label}
            </label>
          ))}
        </RadioGroup>
      </div>

      <Button className='gap-2' onClick={generate}>
        <FileDown className='h-4 w-4' />
        Generar Reporte PDF
      </Button>
    </div>
  )
}

// ─── Kardex ──────────────────────────────────────────────────────────────────
function ReporteKardex({ noCia }: { noCia: string }) {
  const today = new Date()
  const thirtyAgo = new Date(today)
  thirtyAgo.setDate(today.getDate() - 30)

  const [noProdu, setNoProdu] = useState('')
  const [almacen, setAlmacen] = useState('')
  const [desde, setDesde] = useState(toInputDate(thirtyAgo))
  const [hasta, setHasta] = useState(toInputDate(today))
  const [errorMsg, setErrorMsg] = useState('')

  function generate() {
    if (!noProdu.trim()) {
      setErrorMsg('El código de producto es requerido para el Kardex.')
      return
    }
    setErrorMsg('')
    const qs = new URLSearchParams({ no_cia: noCia, no_produ: noProdu.trim() })
    if (almacen) qs.set('almacen', almacen)
    if (desde) qs.set('desde', desde)
    if (hasta) qs.set('hasta', hasta)
    window.open(`/print/inv-kardex/current?${qs}`, '_blank')
  }

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        <div className='space-y-1.5 sm:col-span-2'>
          <Label>
            Código de Producto <span className='text-destructive'>*</span>
          </Label>
          <Input
            className={`h-9 ${errorMsg ? 'border-destructive' : ''}`}
            placeholder='Código del producto (requerido)'
            value={noProdu}
            onChange={(e) => { setNoProdu(e.target.value); setErrorMsg('') }}
          />
          {errorMsg && <p className='text-xs text-destructive'>{errorMsg}</p>}
        </div>

        <div className='space-y-1.5'>
          <Label>Almacén</Label>
          <AlmacenSelect noCia={noCia} value={almacen} onChange={setAlmacen} />
        </div>

        <div className='space-y-1.5'>
          <Label>Desde</Label>
          <Input type='date' className='h-9' value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>Hasta</Label>
          <Input type='date' className='h-9' value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </div>

      <Button className='gap-2' onClick={generate}>
        <FileDown className='h-4 w-4' />
        Generar Kardex PDF
      </Button>
    </div>
  )
}

// ─── Valorización ─────────────────────────────────────────────────────────────
function ReporteValorizacion({ noCia }: { noCia: string }) {
  const [almacen, setAlmacen] = useState('')
  const [tipoProd, setTipoProd] = useState('')

  function generate() {
    const qs = new URLSearchParams({ no_cia: noCia })
    if (almacen) qs.set('almacen', almacen)
    if (tipoProd) qs.set('tipo_prod', tipoProd)
    window.open(`/print/inv-valorizacion/current?${qs}`, '_blank')
  }

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        <div className='space-y-1.5'>
          <Label>Almacén</Label>
          <AlmacenSelect noCia={noCia} value={almacen} onChange={setAlmacen} />
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
      </div>

      <Button className='gap-2' onClick={generate}>
        <FileDown className='h-4 w-4' />
        Generar Valorización PDF
      </Button>
    </div>
  )
}

// ─── Líneas y Sublíneas ───────────────────────────────────────────────────────
function ReporteLineasSublineas({ noCia }: { noCia: string }) {
  const [lineaIni, setLineaIni] = useState('')
  const [lineaFin, setLineaFin] = useState('')
  const [detalleSublinea, setDetalleSublinea] = useState(true)

  function generate() {
    const qs = new URLSearchParams({ no_cia: noCia })
    if (lineaIni) qs.set('linea_ini', lineaIni)
    if (lineaFin) qs.set('linea_fin', lineaFin)
    qs.set('detalle_sublinea', detalleSublinea ? '1' : '0')
    window.open(`${API_BASE}/inv/reportes/lineas-sublineas/pdf/?${qs}`, '_blank')
  }

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        <div className='space-y-1.5'>
          <Label>Línea Inicial</Label>
          <Input
            className='h-9'
            placeholder='Código línea inicial'
            value={lineaIni}
            onChange={(e) => setLineaIni(e.target.value)}
          />
        </div>

        <div className='space-y-1.5'>
          <Label>Línea Final</Label>
          <Input
            className='h-9'
            placeholder='Código línea final'
            value={lineaFin}
            onChange={(e) => setLineaFin(e.target.value)}
          />
        </div>

        <div className='flex items-center gap-2 pt-2'>
          <Checkbox
            id='detalle-sublinea'
            checked={detalleSublinea}
            onCheckedChange={(v) => setDetalleSublinea(Boolean(v))}
          />
          <Label htmlFor='detalle-sublinea'>Incluir detalle de sublíneas</Label>
        </div>
      </div>

      <Button className='gap-2' disabled title='Reporte pendiente de implementación'>
        <FileDown className='h-4 w-4' />
        Próximamente
      </Button>
    </div>
  )
}

// ─── FINV303 — Auxiliar de Inventario ────────────────────────────────────────
function ReporteAuxiliar({ noCia }: { noCia: string }) {
  const today = new Date()
  const [mes, setMes] = useState(String(today.getMonth() + 1).padStart(2, '0'))
  const [anio, setAnio] = useState(String(today.getFullYear()))
  const [almacen, setAlmacen] = useState('')
  const [grupo, setGrupo] = useState('')
  const [linea, setLinea] = useState('')
  const [sublinea, setSublinea] = useState('')
  const [noProdu, setNoProdu] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const [grupos, setGrupos] = useState<any[]>([])
  const [lineas, setLineas] = useState<any[]>([])

  useEffect(() => {
    if (!noCia) return
    apiFetch<any>(`/inv/grupos/?no_cia=${noCia}`)
      .then((d) => setGrupos(Array.isArray(d) ? d : d.items ?? d.results ?? []))
      .catch(() => {})
    apiFetch<any>(`/inv/lineas/?no_cia=${noCia}`)
      .then((d) => setLineas(Array.isArray(d) ? d : d.items ?? d.results ?? []))
      .catch(() => {})
  }, [noCia])

  function generate(formato: 'pdf' | 'excel') {
    const qs = new URLSearchParams({ no_cia: noCia })
    if (mes) qs.set('mes', mes)
    if (anio) qs.set('anio', anio)
    if (almacen) qs.set('almacen', almacen)
    if (grupo) qs.set('grupo', grupo)
    if (linea) qs.set('linea', linea)
    if (sublinea) qs.set('sublinea', sublinea)
    if (noProdu) qs.set('no_produ', noProdu)
    if (desde) qs.set('desde', desde)
    if (hasta) qs.set('hasta', hasta)
    const endpoint = formato === 'excel'
      ? `${API_BASE}/inv/reportes/auxiliar/excel/?${qs}`
      : `${API_BASE}/inv/reportes/auxiliar/pdf/?${qs}`
    window.open(endpoint, '_blank')
  }

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        <div className='space-y-1.5'>
          <Label>Mes</Label>
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className='h-9'><SelectValue /></SelectTrigger>
            <SelectContent>
              {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m) => (
                <SelectItem key={m} value={m}>
                  {new Date(2000, parseInt(m) - 1).toLocaleString('es', { month: 'long' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-1.5'>
          <Label>Año</Label>
          <Input className='h-9' value={anio} onChange={(e) => setAnio(e.target.value)} placeholder='Ej: 2025' />
        </div>

        <div className='space-y-1.5'>
          <Label>Almacén</Label>
          <AlmacenSelect noCia={noCia} value={almacen} onChange={setAlmacen} />
        </div>

        <div className='space-y-1.5'>
          <Label>Grupo</Label>
          <Select value={grupo || '__all__'} onValueChange={(v) => setGrupo(v === '__all__' ? '' : v)}>
            <SelectTrigger className='h-9'><SelectValue placeholder='Todos' /></SelectTrigger>
            <SelectContent>
              <SelectItem value='__all__'>Todos</SelectItem>
              {grupos.map((g: any) => {
                const key = g.grupo ?? g.codigo ?? g.id
                return <SelectItem key={key} value={String(key)}>{g.descripcion ?? key}</SelectItem>
              })}
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-1.5'>
          <Label>Línea</Label>
          <Select value={linea || '__all__'} onValueChange={(v) => setLinea(v === '__all__' ? '' : v)}>
            <SelectTrigger className='h-9'><SelectValue placeholder='Todas' /></SelectTrigger>
            <SelectContent>
              <SelectItem value='__all__'>Todas</SelectItem>
              {lineas.map((l: any) => {
                const key = l.linea ?? l.codigo ?? l.id
                return <SelectItem key={key} value={String(key)}>{l.descripcion ?? key}</SelectItem>
              })}
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-1.5'>
          <Label>Sublínea</Label>
          <Input className='h-9' placeholder='Código sublínea' value={sublinea} onChange={(e) => setSublinea(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>Código Producto</Label>
          <Input className='h-9' placeholder='Ej: PROD001' value={noProdu} onChange={(e) => setNoProdu(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>Desde Fecha</Label>
          <Input type='date' className='h-9' value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>Hasta Fecha</Label>
          <Input type='date' className='h-9' value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </div>

      <div className='flex gap-3'>
        <Button className='gap-2' disabled title='Reporte pendiente de implementación'>
          <FileDown className='h-4 w-4' />
          Próximamente
        </Button>
      </div>
    </div>
  )
}

// ─── FINV305 — Etiquetas Masivas (Intermec) ───────────────────────────────────
function ReporteEtiquetasMasivas({ noCia }: { noCia: string }) {
  const [almacen, setAlmacen] = useState('')
  const [grupoContable, setGrupoContable] = useState('')
  const [grupo, setGrupo] = useState('')
  const [linea, setLinea] = useState('')
  const [sublinea, setSublinea] = useState('')
  const [marca, setMarca] = useState('')
  const [soloExistencia, setSoloExistencia] = useState(false)
  const [soloActivos, setSoloActivos] = useState(true)
  const [listaPrecio, setListaPrecio] = useState('')
  const [desdeProd, setDesdeProd] = useState('')
  const [hastaProd, setHastaProd] = useState('')
  const [tipoEtiqueta, setTipoEtiqueta] = useState<'barras' | 'no-produ' | 'gondola'>('barras')

  function generate() {
    const qs = new URLSearchParams({ no_cia: noCia })
    if (almacen) qs.set('almacen', almacen)
    if (grupoContable) qs.set('grupo_contable', grupoContable)
    if (grupo) qs.set('grupo', grupo)
    if (linea) qs.set('linea', linea)
    if (sublinea) qs.set('sublinea', sublinea)
    if (marca) qs.set('marca', marca)
    qs.set('solo_existencia', soloExistencia ? '1' : '0')
    qs.set('solo_activos', soloActivos ? '1' : '0')
    if (listaPrecio) qs.set('lista_precio', listaPrecio)
    if (desdeProd) qs.set('desde_prod', desdeProd)
    if (hastaProd) qs.set('hasta_prod', hastaProd)
    qs.set('tipo_etiqueta', tipoEtiqueta)
    window.open(`${API_BASE}/inv/reportes/etiquetas/masivas/pdf/?${qs}`, '_blank')
  }

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        <div className='space-y-1.5'>
          <Label>Almacén</Label>
          <AlmacenSelect noCia={noCia} value={almacen} onChange={setAlmacen} />
        </div>

        <div className='space-y-1.5'>
          <Label>Grupo Contable</Label>
          <Input className='h-9' placeholder='Código grupo contable' value={grupoContable} onChange={(e) => setGrupoContable(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>Grupo Producto</Label>
          <Input className='h-9' placeholder='Código grupo' value={grupo} onChange={(e) => setGrupo(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>Línea</Label>
          <Input className='h-9' placeholder='Código línea' value={linea} onChange={(e) => setLinea(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>Sublínea</Label>
          <Input className='h-9' placeholder='Código sublínea' value={sublinea} onChange={(e) => setSublinea(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>Marca</Label>
          <Input className='h-9' placeholder='Código marca' value={marca} onChange={(e) => setMarca(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>Lista de Precio</Label>
          <Input className='h-9' placeholder='No. lista de precio' value={listaPrecio} onChange={(e) => setListaPrecio(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>Desde Producto</Label>
          <Input className='h-9' placeholder='Código inicial' value={desdeProd} onChange={(e) => setDesdeProd(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>Hasta Producto</Label>
          <Input className='h-9' placeholder='Código final' value={hastaProd} onChange={(e) => setHastaProd(e.target.value)} />
        </div>

        <div className='flex flex-col gap-3 pt-1'>
          <div className='flex items-center gap-2'>
            <Checkbox id='solo-existencia' checked={soloExistencia} onCheckedChange={(v) => setSoloExistencia(Boolean(v))} />
            <Label htmlFor='solo-existencia'>Solo con existencia</Label>
          </div>
          <div className='flex items-center gap-2'>
            <Checkbox id='solo-activos' checked={soloActivos} onCheckedChange={(v) => setSoloActivos(Boolean(v))} />
            <Label htmlFor='solo-activos'>Solo activos</Label>
          </div>
        </div>
      </div>

      <div className='space-y-2'>
        <Label>Tipo de Impresión</Label>
        <RadioGroup value={tipoEtiqueta} onValueChange={(v) => setTipoEtiqueta(v as typeof tipoEtiqueta)} className='flex gap-4'>
          {[
            { value: 'barras', label: 'Código de Barras' },
            { value: 'no-produ', label: 'No Producto' },
            { value: 'gondola', label: 'Etiqueta Góndola' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm transition-colors
                ${tipoEtiqueta === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
            >
              <RadioGroupItem value={opt.value} />
              {opt.label}
            </label>
          ))}
        </RadioGroup>
      </div>

      <Button className='gap-2' onClick={generate}>
        <Printer className='h-4 w-4' />
        Imprimir Etiquetas
      </Button>
    </div>
  )
}

// ─── FINV306 — Barras por Documento ──────────────────────────────────────────
function ReporteBarrasDocumento({ noCia }: { noCia: string }) {
  const [tipoDoc, setTipoDoc] = useState<'F' | 'I'>('F')
  const [noDocu, setNoDocu] = useState('')
  const [fecha, setFecha] = useState(toInputDate(new Date()))
  const [cliente, setCliente] = useState('')
  const [tipoCodigo, setTipoCodigo] = useState<'barras' | 'no-produ'>('barras')
  const [tipoImpresion, setTipoImpresion] = useState('ean13-peq')

  function generate() {
    const qs = new URLSearchParams({ no_cia: noCia })
    qs.set('tipo_doc', tipoDoc)
    if (noDocu) qs.set('no_docu', noDocu)
    if (fecha) qs.set('fecha', fecha)
    if (cliente) qs.set('cliente', cliente)
    qs.set('tipo_codigo', tipoCodigo)
    qs.set('tipo_impresion', tipoImpresion)
    window.open(`${API_BASE}/inv/reportes/etiquetas/documento/pdf/?${qs}`, '_blank')
  }

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        <div className='space-y-1.5'>
          <Label>Tipo de Impresión</Label>
          <Select value={tipoImpresion} onValueChange={setTipoImpresion}>
            <SelectTrigger className='h-9'><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value='ean13-peq'>Código EAN13 Pequeño</SelectItem>
              <SelectItem value='ean13-grd'>Código EAN13 Grande</SelectItem>
              <SelectItem value='code128'>Code 128</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-1.5'>
          <Label>No. Documento</Label>
          <Input className='h-9' placeholder='Número de documento' value={noDocu} onChange={(e) => setNoDocu(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>Fecha</Label>
          <Input type='date' className='h-9' value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>Cliente</Label>
          <Input className='h-9' placeholder='Código o nombre de cliente' value={cliente} onChange={(e) => setCliente(e.target.value)} />
        </div>
      </div>

      <div className='space-y-2'>
        <Label>Documento de</Label>
        <RadioGroup value={tipoDoc} onValueChange={(v) => setTipoDoc(v as typeof tipoDoc)} className='flex gap-4'>
          {[
            { value: 'F', label: 'Facturación' },
            { value: 'I', label: 'Inventario' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm transition-colors
                ${tipoDoc === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
            >
              <RadioGroupItem value={opt.value} />
              {opt.label}
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className='space-y-2'>
        <Label>Tipo de Código</Label>
        <RadioGroup value={tipoCodigo} onValueChange={(v) => setTipoCodigo(v as typeof tipoCodigo)} className='flex gap-4'>
          {[
            { value: 'barras', label: 'Código de Barra' },
            { value: 'no-produ', label: 'No Producto' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm transition-colors
                ${tipoCodigo === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
            >
              <RadioGroupItem value={opt.value} />
              {opt.label}
            </label>
          ))}
        </RadioGroup>
      </div>

      <Button className='gap-2' onClick={generate}>
        <Printer className='h-4 w-4' />
        Imprimir
      </Button>
    </div>
  )
}

// ─── FINV307 — Etiquetas Individual ──────────────────────────────────────────
interface EtiquetaItem {
  id: number
  noProdu: string
  nombre: string
  unidad: string
  peso: string
  fechaFab: string
  bach: string
  cantidad: number
  cantEtiquetas: number
}

function ReporteEtiquetasIndividual({ noCia }: { noCia: string }) {
  const [items, setItems] = useState<EtiquetaItem[]>([
    { id: 1, noProdu: '', nombre: '', unidad: '', peso: '', fechaFab: '', bach: '', cantidad: 1, cantEtiquetas: 1 },
  ])

  function addRow() {
    setItems((prev) => [
      ...prev,
      { id: Date.now(), noProdu: '', nombre: '', unidad: '', peso: '', fechaFab: '', bach: '', cantidad: 1, cantEtiquetas: 1 },
    ])
  }

  function removeRow(id: number) {
    setItems((prev) => prev.filter((r) => r.id !== id))
  }

  function updateRow(id: number, field: keyof EtiquetaItem, value: string | number) {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  function generate() {
    const qs = new URLSearchParams({ no_cia: noCia })
    const payload = items
      .filter((r) => r.noProdu.trim())
      .map((r) => `${r.noProdu}:${r.cantEtiquetas}`)
      .join(',')
    if (payload) qs.set('productos', payload)
    window.open(`${API_BASE}/inv/reportes/etiquetas/individual/pdf/?${qs}`, '_blank')
  }

  return (
    <div className='space-y-5'>
      <div className='overflow-x-auto rounded-md border'>
        <table className='w-full text-sm'>
          <thead className='bg-muted/50'>
            <tr>
              {['No. Produ', 'Nombre', 'Unidad', 'Peso', 'Fecha Fab.', 'Bach', 'Cantidad', 'Cant. Etiquetas', ''].map((h) => (
                <th key={h} className='px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap'>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className='border-t'>
                <td className='px-2 py-1'>
                  <Input className='h-8 w-24' value={row.noProdu} onChange={(e) => updateRow(row.id, 'noProdu', e.target.value)} />
                </td>
                <td className='px-2 py-1'>
                  <Input className='h-8 w-36' value={row.nombre} onChange={(e) => updateRow(row.id, 'nombre', e.target.value)} />
                </td>
                <td className='px-2 py-1'>
                  <Input className='h-8 w-20' value={row.unidad} onChange={(e) => updateRow(row.id, 'unidad', e.target.value)} />
                </td>
                <td className='px-2 py-1'>
                  <Input className='h-8 w-20' value={row.peso} onChange={(e) => updateRow(row.id, 'peso', e.target.value)} />
                </td>
                <td className='px-2 py-1'>
                  <Input type='date' className='h-8 w-36' value={row.fechaFab} onChange={(e) => updateRow(row.id, 'fechaFab', e.target.value)} />
                </td>
                <td className='px-2 py-1'>
                  <Input className='h-8 w-20' value={row.bach} onChange={(e) => updateRow(row.id, 'bach', e.target.value)} />
                </td>
                <td className='px-2 py-1'>
                  <Input type='number' min={1} className='h-8 w-20' value={row.cantidad} onChange={(e) => updateRow(row.id, 'cantidad', Number(e.target.value))} />
                </td>
                <td className='px-2 py-1'>
                  <Input type='number' min={1} className='h-8 w-24' value={row.cantEtiquetas} onChange={(e) => updateRow(row.id, 'cantEtiquetas', Number(e.target.value))} />
                </td>
                <td className='px-2 py-1'>
                  <Button variant='ghost' size='sm' className='h-8 px-2 text-destructive' onClick={() => removeRow(row.id)}>✕</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className='flex gap-3'>
        <Button variant='outline' size='sm' onClick={addRow}>+ Agregar Fila</Button>
        <Button className='gap-2' onClick={generate}>
          <Printer className='h-4 w-4' />
          Imprimir Etiquetas
        </Button>
      </div>
    </div>
  )
}

// ─── Monarch 9416 ─────────────────────────────────────────────────────────────
function ReporteEtiquetasMonarch({ noCia }: { noCia: string }) {
  const [almacen, setAlmacen] = useState('')
  const [conExistencia, setConExistencia] = useState<'S' | 'N'>('S')
  const [desdeProd, setDesdeProd] = useState('')
  const [hastaProd, setHastaProd] = useState('')
  const [copias, setCopias] = useState('1')

  function generate() {
    const qs = new URLSearchParams({ no_cia: noCia })
    if (almacen) qs.set('almacen', almacen)
    qs.set('con_existencia', conExistencia)
    if (desdeProd) qs.set('desde_prod', desdeProd)
    if (hastaProd) qs.set('hasta_prod', hastaProd)
    qs.set('copias', copias)
    window.open(`${API_BASE}/inv/reportes/etiquetas/monarch/pdf/?${qs}`, '_blank')
  }

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        <div className='space-y-1.5'>
          <Label>No. Almacén</Label>
          <AlmacenSelect noCia={noCia} value={almacen} onChange={setAlmacen} />
        </div>

        <div className='space-y-1.5'>
          <Label>Copias</Label>
          <Input type='number' min={1} className='h-9' value={copias} onChange={(e) => setCopias(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>Desde Producto</Label>
          <Input className='h-9' placeholder='Código inicial' value={desdeProd} onChange={(e) => setDesdeProd(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>Hasta Producto</Label>
          <Input className='h-9' placeholder='Código final' value={hastaProd} onChange={(e) => setHastaProd(e.target.value)} />
        </div>
      </div>

      <div className='space-y-2'>
        <Label>Con Existencia</Label>
        <RadioGroup value={conExistencia} onValueChange={(v) => setConExistencia(v as 'S' | 'N')} className='flex gap-4'>
          {[
            { value: 'S', label: 'Sí' },
            { value: 'N', label: 'No' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm transition-colors
                ${conExistencia === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
            >
              <RadioGroupItem value={opt.value} />
              {opt.label}
            </label>
          ))}
        </RadioGroup>
      </div>

      <Button className='gap-2' onClick={generate}>
        <Printer className='h-4 w-4' />
        Imprimir Monarch 9416
      </Button>
    </div>
  )
}

// ─── FINV304 — Consumo por Proyecto ───────────────────────────────────────────
function ReporteConsumoProyecto({ noCia }: { noCia: string }) {
  const today = new Date()
  const [almacen, setAlmacen] = useState('')
  const [sublinea, setSublinea] = useState('')
  const [mes, setMes] = useState(String(today.getMonth() + 1).padStart(2, '0'))
  const [anio, setAnio] = useState(String(today.getFullYear()))
  const [noLocalidad, setNoLocalidad] = useState('')
  const [tipoProyecto, setTipoProyecto] = useState('')
  const [noProyecto, setNoProyecto] = useState('')
  const [noComponente, setNoComponente] = useState('')
  const [noProdu, setNoProdu] = useState('')
  const [tipoMovimiento, setTipoMovimiento] = useState<'ambas' | 'E' | 'S'>('ambas')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [tipoReporte, setTipoReporte] = useState<'proyecto' | 'componente'>('proyecto')
  const [modoReporte, setModoReporte] = useState<'res-proy' | 'res-prod' | 'detallado'>('res-proy')

  function generate() {
    const qs = new URLSearchParams({ no_cia: noCia })
    if (almacen) qs.set('almacen', almacen)
    if (sublinea) qs.set('sublinea', sublinea)
    if (mes) qs.set('mes', mes)
    if (anio) qs.set('anio', anio)
    if (noLocalidad) qs.set('no_localidad', noLocalidad)
    if (tipoProyecto) qs.set('tipo_proyecto', tipoProyecto)
    if (noProyecto) qs.set('no_proyecto', noProyecto)
    if (noComponente) qs.set('no_componente', noComponente)
    if (noProdu) qs.set('no_produ', noProdu)
    qs.set('tipo_movimiento', tipoMovimiento)
    if (desde) qs.set('desde', desde)
    if (hasta) qs.set('hasta', hasta)
    qs.set('tipo_reporte', tipoReporte)
    qs.set('modo_reporte', modoReporte)
    window.open(`${API_BASE}/inv/reportes/consumo-proyecto/pdf/?${qs}`, '_blank')
  }

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        <div className='space-y-1.5'>
          <Label>Almacén</Label>
          <AlmacenSelect noCia={noCia} value={almacen} onChange={setAlmacen} />
        </div>

        <div className='space-y-1.5'>
          <Label>Sublínea</Label>
          <Input className='h-9' placeholder='Código sublínea' value={sublinea} onChange={(e) => setSublinea(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>Mes</Label>
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className='h-9'><SelectValue /></SelectTrigger>
            <SelectContent>
              {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m) => (
                <SelectItem key={m} value={m}>
                  {new Date(2000, parseInt(m) - 1).toLocaleString('es', { month: 'long' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-1.5'>
          <Label>Año</Label>
          <Input className='h-9' value={anio} onChange={(e) => setAnio(e.target.value)} placeholder='Ej: 2025' />
        </div>

        <div className='space-y-1.5'>
          <Label>No. Localidad</Label>
          <Input className='h-9' placeholder='Número de localidad' value={noLocalidad} onChange={(e) => setNoLocalidad(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>Tipo de Proyecto</Label>
          <Input className='h-9' placeholder='Código tipo proyecto' value={tipoProyecto} onChange={(e) => setTipoProyecto(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>No. Proyecto</Label>
          <Input className='h-9' placeholder='Número de proyecto' value={noProyecto} onChange={(e) => setNoProyecto(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>No. Componente</Label>
          <Input className='h-9' placeholder='Número de componente' value={noComponente} onChange={(e) => setNoComponente(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>Producto</Label>
          <Input className='h-9' placeholder='Código de producto' value={noProdu} onChange={(e) => setNoProdu(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>Desde Fecha</Label>
          <Input type='date' className='h-9' value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>

        <div className='space-y-1.5'>
          <Label>Hasta Fecha</Label>
          <Input type='date' className='h-9' value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </div>

      <div className='space-y-2'>
        <Label>Tipo de Movimiento</Label>
        <RadioGroup value={tipoMovimiento} onValueChange={(v) => setTipoMovimiento(v as typeof tipoMovimiento)} className='flex gap-4'>
          {[
            { value: 'ambas', label: 'Ambas (E+S)' },
            { value: 'E', label: 'Entradas' },
            { value: 'S', label: 'Salidas' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm transition-colors
                ${tipoMovimiento === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
            >
              <RadioGroupItem value={opt.value} />
              {opt.label}
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className='space-y-2'>
        <Label>Tipo de Reporte</Label>
        <RadioGroup value={tipoReporte} onValueChange={(v) => setTipoReporte(v as typeof tipoReporte)} className='flex gap-4'>
          {[
            { value: 'proyecto', label: 'Por Proyecto' },
            { value: 'componente', label: 'Por Componente' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm transition-colors
                ${tipoReporte === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
            >
              <RadioGroupItem value={opt.value} />
              {opt.label}
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className='space-y-2'>
        <Label>Modo de Reporte</Label>
        <RadioGroup value={modoReporte} onValueChange={(v) => setModoReporte(v as typeof modoReporte)} className='flex gap-4'>
          {[
            { value: 'res-proy', label: 'Resumido Proy.' },
            { value: 'res-prod', label: 'Resumido Prod.' },
            { value: 'detallado', label: 'Detallado' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm transition-colors
                ${modoReporte === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
            >
              <RadioGroupItem value={opt.value} />
              {opt.label}
            </label>
          ))}
        </RadioGroup>
      </div>

      <Button className='gap-2' disabled title='Reporte pendiente de implementación'>
        <FileDown className='h-4 w-4' />
        Próximamente
      </Button>
    </div>
  )
}

// ─── Report labels ────────────────────────────────────────────────────────────
const REPORT_LABELS: Record<ReportType, string> = {
  existencia: 'Existencia de Inventario',
  movimientos: 'Movimiento de Productos',
  kardex: 'Kardex Valorizado',
  valorizacion: 'Valorización de Inventario',
  'lineas-sublineas': 'Listado de Líneas y Sublíneas',
  auxiliar: 'Auxiliar de Inventario',
  'etiquetas-masivas': 'Etiquetas y Códigos de Barras — Masivo',
  'barras-documento': 'Barras por Documentos',
  'etiquetas-individual': 'Imprimir Etiquetas Individual',
  'etiquetas-monarch': 'Etiquetas Monarch 9416',
  'consumo-proyecto': 'Consumo por Proyectos',
}

const REPORT_DESCRIPTIONS: Record<ReportType, string> = {
  existencia: 'Existencia actual por producto y almacén — Rinv301/302/307/310/317/306/312/325/328',
  movimientos: 'Historial de entradas, salidas y ajustes — Rinv304/Rinv314',
  kardex: 'Movimientos valorizados con saldo acumulado — Rinv703',
  valorizacion: 'Valor total del inventario por costo promedio — Rinv704',
  'lineas-sublineas': 'Catálogo de líneas y sublíneas — Rinv311',
  auxiliar: 'Movimientos agrupados con salida PDF o Excel — FINV303 / Rinv_auxiliar',
  'etiquetas-masivas': 'Impresión masiva de etiquetas Intermec — FINV305',
  'barras-documento': 'Códigos de barras por documento de facturación o inventario — FINV306',
  'etiquetas-individual': 'Etiquetas por producto con cantidad configurable — FINV307',
  'etiquetas-monarch': 'Etiquetas para impresora Monarch 9416 — Rinv_Monarch9416',
  'consumo-proyecto': 'Consumo de materiales por proyecto, componente y producto — FINV304',
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ReportesParametros({ reportType, noCia: noCiaProp, punto: _punto }: Props) {
  const { selectedCompany } = useCompany()
  const noCia = noCiaProp || selectedCompany || '01'

  return (
    <div className='space-y-5'>
      <div>
        <h2 className='text-lg font-semibold'>{REPORT_LABELS[reportType]}</h2>
        <p className='text-sm text-muted-foreground'>{REPORT_DESCRIPTIONS[reportType]}</p>
      </div>

      <div className='rounded-md border p-5 bg-muted/20'>
        {reportType === 'existencia' && <ReporteExistencia noCia={noCia} />}
        {reportType === 'movimientos' && <ReporteMovimientos noCia={noCia} />}
        {reportType === 'kardex' && <ReporteKardex noCia={noCia} />}
        {reportType === 'valorizacion' && <ReporteValorizacion noCia={noCia} />}
        {reportType === 'lineas-sublineas' && <ReporteLineasSublineas noCia={noCia} />}
        {reportType === 'auxiliar' && <ReporteAuxiliar noCia={noCia} />}
        {reportType === 'etiquetas-masivas' && <ReporteEtiquetasMasivas noCia={noCia} />}
        {reportType === 'barras-documento' && <ReporteBarrasDocumento noCia={noCia} />}
        {reportType === 'etiquetas-individual' && <ReporteEtiquetasIndividual noCia={noCia} />}
        {reportType === 'etiquetas-monarch' && <ReporteEtiquetasMonarch noCia={noCia} />}
        {reportType === 'consumo-proyecto' && <ReporteConsumoProyecto noCia={noCia} />}
      </div>
    </div>
  )
}
