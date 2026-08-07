import { useEffect, useState } from 'react'
import { FileDown, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

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

type TipoReporte = 'codigo' | 'alfabetico' | 'resumido-excel'

const OPCIONES_REPORTE: { value: TipoReporte; label: string; rpt: string }[] = [
  { value: 'codigo', label: 'Por Código (Rinv702)', rpt: 'codigo' },
  { value: 'alfabetico', label: 'Alfabético (Rinv706)', rpt: 'alfabetico' },
  { value: 'resumido-excel', label: 'Resumido Excel', rpt: 'resumido' },
]

export function ComparativoFisico({ noCia, punto }: Props) {
  const [almacen, setAlmacen] = useState('')
  const [grupo, setGrupo] = useState('')
  const [linea, setLinea] = useState('')
  const [sublinea, setSublinea] = useState('')
  const [codProducto, setCodProducto] = useState('')
  const [tipoProd, setTipoProd] = useState('')
  const [soloInventariados, setSoloInventariados] = useState(false)
  const [masDeUnaVez, setMasDeUnaVez] = useState(false)
  const [tipoReporte, setTipoReporte] = useState<TipoReporte>('codigo')
  const [resumen, setResumen] = useState(false)
  const [filtroProds, setFiltroProds] = useState('todos')
  const [contador, setContador] = useState('')

  const [almacenes, setAlmacenes] = useState<any[]>([])
  const [grupos, setGrupos] = useState<any[]>([])
  const [lineas, setLineas] = useState<any[]>([])

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
    if (contador) qs.set('contador', contador)
    qs.set('solo_inventariados', soloInventariados ? '1' : '0')
    qs.set('mas_de_una_vez', masDeUnaVez ? '1' : '0')
    qs.set('resumen', resumen ? '1' : '0')
    qs.set('filtro_prods', filtroProds)
    return qs.toString()
  }

  function handleReporte() {
    if (tipoReporte === 'resumido-excel') {
      window.open(`${API_BASE}/inv/conteo-fisico/comparativo/excel/?${buildQs()}`, '_blank')
    } else {
      window.open(
        `${API_BASE}/inv/conteo-fisico/comparativo/pdf/?tipo=${tipoReporte}&${buildQs()}`,
        '_blank'
      )
    }
  }

  function handleExcel() {
    window.open(`${API_BASE}/inv/conteo-fisico/comparativo/excel/?${buildQs()}`, '_blank')
  }

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-lg font-semibold'>Comparativo Físico vs Teórico</h2>
        <p className='text-sm text-muted-foreground'>
          FINV702 — Rinv702 (por código) / Rinv706 (alfabético) / Resumido Excel.
        </p>
      </div>

      <div className='rounded-md border p-5 bg-muted/20 space-y-5'>
        {/* Filtros principales */}
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

          <div className='space-y-1.5'>
            <Label>Contador</Label>
            <Input
              className='h-9'
              placeholder='Código de contador'
              value={contador}
              onChange={(e) => setContador(e.target.value)}
            />
          </div>

          <div className='space-y-1.5'>
            <Label>Desea Productos</Label>
            <Select value={filtroProds} onValueChange={setFiltroProds}>
              <SelectTrigger className='h-9'><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value='todos'>Todos</SelectItem>
                <SelectItem value='con-diferencia'>Con Diferencia</SelectItem>
                <SelectItem value='sin-diferencia'>Sin Diferencia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Switches */}
        <div className='flex flex-wrap gap-6 pt-1'>
          <div className='flex items-center gap-3'>
            <Switch id='solo-inv' checked={soloInventariados} onCheckedChange={setSoloInventariados} />
            <Label htmlFor='solo-inv'>Solo inventariados</Label>
          </div>
          <div className='flex items-center gap-3'>
            <Switch id='mas-una' checked={masDeUnaVez} onCheckedChange={setMasDeUnaVez} />
            <Label htmlFor='mas-una'>Contados más de una vez</Label>
          </div>
          <div className='flex items-center gap-3'>
            <Switch id='resumen' checked={resumen} onCheckedChange={setResumen} />
            <Label htmlFor='resumen'>Resumen</Label>
          </div>
        </div>

        {/* Tipo de reporte */}
        <div className='space-y-2'>
          <Label>Tipo de Reporte</Label>
          <RadioGroup
            value={tipoReporte}
            onValueChange={(v) => setTipoReporte(v as TipoReporte)}
            className='flex flex-col sm:flex-row gap-3'
          >
            {OPCIONES_REPORTE.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-2 rounded-md border px-4 py-2.5 cursor-pointer text-sm transition-colors
                  ${tipoReporte === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
              >
                <RadioGroupItem value={opt.value} />
                {opt.label}
              </label>
            ))}
          </RadioGroup>
        </div>

        {/* Botones — reporte pendiente de implementación (backend no disponible) */}
        <div className='flex flex-wrap gap-3 pt-2 border-t'>
          <Button className='gap-2' disabled title='Reporte pendiente de implementación'>
            <Printer className='h-4 w-4' />
            Próximamente
          </Button>
        </div>
      </div>
    </div>
  )
}
