// CxP Procesos: entrada-documentos, reversar, liberar-debito, bloquear-pago,
// asiento-contable, generar-asiento, cierre.
//
// Cada componente conecta a un endpoint ya existente en apps/legacy/cxp_views.py.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Save,
  RotateCcw,
  Lock,
  Unlock,
  FileText,
  Play,
  Search,
  Printer,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { regalGeneralApi as api } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PeriodoBadge, AlertIrreversible } from '@/components/cierre'
import { GuardedButton } from '@/components/access'
import { buildReportMeta } from '../cnt/export-utils'
import {
  Dialog,
  DialogContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface P {
  noCia: string
  punto?: string
}

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
const today = new Date().toISOString().slice(0, 10)
const curYear = new Date().getFullYear()
const curMonth = new Date().getMonth() + 1

// NCF DGI real = posiciones_fijas_ncf (B01-B15 o E31/E32) || LPAD(ncf,8,'0').
// CODIGO_NCF/TIPO_NCF_FISCAL son legacy y suelen venir vacíos.
const ncfDgi = (doc: any): string => {
  const pos = (doc?.posiciones_fijas_ncf ?? '').toString().trim().toUpperCase()
  const n = doc?.ncf
  if (!pos || n == null || n === '') return ''
  return pos + String(n).padStart(8, '0')
}

// ─── Selector de proveedor: input código + lupa + modal de búsqueda ──────────
// Patrón igual al selector de cliente en FAT nueva-factura.
export function ProveedorPicker({
  value,
  onChange,
}: {
  value: {
    no_proveedor: string
    nombre: string
    rnc: string
    direccion: string
  } | null
  onChange: (p: any | null) => void
}) {
  const [codigo, setCodigo] = useState(value?.no_proveedor ?? '')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [loadingCode, setLoadingCode] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setCodigo(value?.no_proveedor ?? '')
  }, [value?.no_proveedor])

  const cargarPorCodigo = async (cod: string) => {
    const trimmed = cod.trim()
    if (!trimmed) {
      onChange(null)
      return
    }
    setLoadingCode(true)
    try {
      const p = await api.cxpGetProveedor(trimmed)
      if (p && p.no_proveedor) onChange(p)
      else {
        toast.error(`Proveedor ${trimmed} no encontrado`)
        onChange(null)
      }
    } catch {
      toast.error(`Proveedor ${trimmed} no encontrado`)
      onChange(null)
    } finally {
      setLoadingCode(false)
    }
  }

  const buscar = async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const rows = await api.cxpListProveedores({ search: q, activo: 'S' })
      setResults(rows)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const aplicar = (p: any) => {
    onChange(p)
    setOpen(false)
    setSearch('')
    setResults([])
  }

  const abrirModal = () => {
    setOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }

  return (
    <div className='flex items-end gap-2 md:col-span-3'>
      <div className='w-36 space-y-1'>
        <Label className='text-xs'>Código Proveedor *</Label>
        <Input
          ref={inputRef}
          value={codigo}
          onChange={(e) => {
            setCodigo(e.target.value)
            if (value) onChange(null)
          }}
          onBlur={(e) => cargarPorCodigo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') cargarPorCodigo(codigo)
          }}
          placeholder='Código'
          disabled={loadingCode}
          className='h-10 font-mono'
        />
      </div>
      <Button
        variant='outline'
        onClick={abrirModal}
        className='h-10 px-3'
        type='button'
        title='Buscar proveedor'
      >
        <Search className='h-4 w-4' />
      </Button>
      {value ? (
        <div className='flex flex-1 flex-wrap items-center gap-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2'>
          <div className='min-w-0'>
            <span className='block text-xs font-medium text-emerald-600'>
              Nombre
            </span>
            <span className='block truncate font-semibold text-emerald-900'>
              {value.nombre}
            </span>
          </div>
          {value.rnc && (
            <div className='shrink-0'>
              <span className='block text-xs font-medium text-emerald-600'>
                RNC / Cédula
              </span>
              <span className='font-mono text-sm text-emerald-800'>
                {value.rnc}
              </span>
            </div>
          )}
          {value.direccion && (
            <div className='min-w-0'>
              <span className='block text-xs font-medium text-emerald-600'>
                Dirección
              </span>
              <span className='block truncate text-sm text-emerald-700'>
                {value.direccion}
              </span>
            </div>
          )}
          <Button
            size='sm'
            variant='ghost'
            onClick={() => {
              onChange(null)
              setCodigo('')
            }}
            className='ml-auto shrink-0 text-gray-400 hover:text-red-500'
          >
            Cambiar
          </Button>
        </div>
      ) : (
        <div className='flex h-10 flex-1 items-center rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-400'>
          {loadingCode
            ? 'Cargando proveedor…'
            : 'Ingrese código o use la lupa para buscar'}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='flex h-auto max-h-[80vh] min-h-[40vh] w-[90vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-h-[80vh] sm:max-w-none lg:w-[60vw]'>
          <DialogHeader className='shrink-0 border-b px-6 py-4'>
            <DialogTitle>Buscar Proveedor</DialogTitle>
          </DialogHeader>
          <div className='shrink-0 border-b bg-background px-6 py-3'>
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                buscar(e.target.value)
              }}
              placeholder='Buscar por nombre, código o RNC…'
              className='h-11 text-base'
              autoFocus
            />
          </div>
          <div className='flex-1 overflow-auto px-6 py-2'>
            <Table>
              <TableHeader className='sticky top-0 z-10 bg-background'>
                <TableRow>
                  <TableHead className='w-32'>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className='w-36'>RNC / Cédula</TableHead>
                  <TableHead className='w-64'>Dirección</TableHead>
                  <TableHead className='w-24 text-center'>Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className='py-12 text-center text-gray-400'
                    >
                      {searching
                        ? 'Buscando…'
                        : search.length >= 2
                          ? 'Sin resultados'
                          : 'Escriba al menos 2 caracteres'}
                    </TableCell>
                  </TableRow>
                )}
                {results.map((p: any) => (
                  <TableRow
                    key={p.no_proveedor}
                    className='cursor-pointer hover:bg-blue-50'
                    onDoubleClick={() => aplicar(p)}
                  >
                    <TableCell className='font-mono font-semibold'>
                      {p.no_proveedor}
                    </TableCell>
                    <TableCell className='font-medium'>{p.nombre}</TableCell>
                    <TableCell className='font-mono text-sm'>
                      {p.rnc || p.cedula || '—'}
                    </TableCell>
                    <TableCell className='max-w-xs truncate text-sm text-gray-600'>
                      {p.direccion || '—'}
                    </TableCell>
                    <TableCell className='text-center'>
                      <Button
                        size='sm'
                        className='h-7 px-3'
                        onClick={() => aplicar(p)}
                      >
                        Seleccionar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className='flex shrink-0 items-center justify-between border-t bg-background px-6 py-3 text-sm text-gray-500'>
            <span>
              {results.length > 0
                ? `${results.length} proveedor${results.length !== 1 ? 'es' : ''} encontrado${results.length !== 1 ? 's' : ''}`
                : ''}
            </span>
            <span className='text-xs'>Doble clic o "Seleccionar"</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── FCXP201 — Entrada de Documentos DR/CR ──────────────────────────────────
export function CxpEntradaDocumentos({ noCia, punto = '' }: P) {
  const [tiposDocu, setTiposDocu] = useState<any[]>([])
  const [tipoDocu, setTipoDocu] = useState('')
  const [siguiente, setSiguiente] = useState('')
  const [proveedor, setProveedor] = useState<any | null>(null)
  const [form, setForm] = useState({
    fecha: today,
    fecha_vence: '',
    valor_bienes: '',
    descripcion: '',
    rnc: '',
    ncf: '',
    tipo_ncf: '',
    isc: '',
    otros_impuestos: '',
    propina: '',
    tipo_gasto: '',
    tipo_retencion: '',
    itbis_retenido: '',
    isr_retenido: '',
    forma_pago: '',
  })
  // ITBIS calculado a partir del valor con la tasa de la empresa (FAT.TFAT_CIAS)
  // o 18% por defecto. Se descuenta si el proveedor está exento.
  const [porcItbis, setPorcItbis] = useState(18)
  const [impuesto, setImpuesto] = useState('')
  const [editandoItbis, setEditandoItbis] = useState(false)
  const [saving, setSaving] = useState(false)

  // Catálogos DGI para los selects opcionales (tipo_gasto, tipo_retencion, forma_pago).
  const [tiposGasto, setTiposGasto] = useState<{ tipo_gasto: string; descripcion: string }[]>([])
  const [tiposRetencion, setTiposRetencion] = useState<{ tipo_retencion: number; descripcion: string; por_defecto: string }[]>([])
  const [formasPago, setFormasPago] = useState<{ forma_pago: number; descripcion: string; por_defecto: string }[]>([])

  useEffect(() => {
    api.cxpListTiposDocu(noCia).then(setTiposDocu).catch(() => {})
    api.cxpListTiposGasto().then(setTiposGasto).catch(() => {})
    api.cxpListTiposRetencion().then((rows) => {
      setTiposRetencion(rows)
      const def = rows.find((r) => r.por_defecto === 'S')
      if (def) setForm((f) => ({ ...f, tipo_retencion: String(def.tipo_retencion) }))
    }).catch(() => {})
    api.cxpListFormasPago().then((rows) => {
      setFormasPago(rows)
      const def = rows.find((r) => r.por_defecto === 'S')
      if (def) setForm((f) => ({ ...f, forma_pago: String(def.forma_pago) }))
    }).catch(() => {})
  }, [noCia])

  useEffect(() => {
    if (!tipoDocu || !punto) {
      setSiguiente('')
      return
    }
    api
      .cxpGetSiguienteNoDocu(noCia, punto, tipoDocu)
      .then((r) => setSiguiente(r.siguiente || ''))
      .catch(() => setSiguiente(''))
  }, [tipoDocu, noCia, punto])

  // Cuando se carga un proveedor, traer su RNC por defecto.
  useEffect(() => {
    if (proveedor?.rnc) setForm((f) => ({ ...f, rnc: proveedor.rnc }))
  }, [proveedor?.no_proveedor]) // eslint-disable-line react-hooks/exhaustive-deps

  // Trae el porcentaje de ITBIS configurado para la empresa (TCNT_CIAS.ITBIS).
  useEffect(() => {
    if (!noCia) return
    api.cntGetCia(noCia)
      .then((c: any) => {
        const p = Number(c?.itbis ?? c?.porc_impuesto ?? 18)
        if (p > 0) setPorcItbis(p)
      })
      .catch(() => { /* default 18 */ })
  }, [noCia])

  // Carga la cuenta contable del proveedor (TCXP_TPROVEEDOR.CUENTA según
  // su TIPO_PROVEEDOR) para mostrarla al usuario antes de guardar.
  const [cuentaProveedor, setCuentaProveedor] = useState<{ cuenta: string; cuenta_prima?: string; nombre?: string } | null>(null)
  useEffect(() => {
    if (!proveedor?.no_proveedor || !punto) { setCuentaProveedor(null); return }
    api.cxpGetProveedorCuenta(proveedor.no_proveedor, noCia, punto)
      .then((r: any) => setCuentaProveedor(r))
      .catch(() => setCuentaProveedor(null))
  }, [proveedor?.no_proveedor, noCia, punto])

  // NCF del proveedor: si TCXP_BPROVEEDOR.codigo_ncf != null, el proveedor
  // es informal y el sistema autoasigna NCF B11 desde CNT.TCNT_NCF. Si
  // null → proveedor formal, el operador digita el NCF que viene en la
  // factura.
  const [ncfInfo, setNcfInfo] = useState<{
    codigo_ncf: string | null
    posiciones_fijas?: string
    prox_ncf?: number
    descripcion?: string
  } | null>(null)
  useEffect(() => {
    if (!proveedor?.no_proveedor || !punto) { setNcfInfo(null); return }
    api.cxpGetProveedorNcfInfo(proveedor.no_proveedor, noCia, punto)
      .then((r) => {
        setNcfInfo(r)
        if (r?.codigo_ncf && r?.prox_ncf != null) {
          // Pre-fill NCF (numero) y tipo_ncf (posiciones_fijas, p.ej. B11)
          setForm((f) => ({
            ...f,
            ncf: String(r.prox_ncf!).padStart(8, '0'),
            tipo_ncf: r.posiciones_fijas || f.tipo_ncf,
          }))
        }
      })
      .catch(() => setNcfInfo(null))
  }, [proveedor?.no_proveedor, noCia, punto])

  // Auto-calcula el ITBIS desde el valor de bienes (sin ITBIS):
  //   itbis = base × porc/100
  //   total = base + itbis (es lo que se registra como valor del documento)
  // Si el proveedor está exento o el ITBIS está siendo editado a mano,
  // no recalcula.
  useEffect(() => {
    if (editandoItbis) return
    const base = Number(form.valor_bienes || 0)
    if (!base) { setImpuesto(''); return }
    const exento = (proveedor?.excento_itbis || 'N').toUpperCase() === 'S'
    if (exento) { setImpuesto('0'); return }
    const itbis = base * (porcItbis / 100)
    setImpuesto(itbis.toFixed(2))
  }, [form.valor_bienes, porcItbis, proveedor?.no_proveedor, proveedor?.excento_itbis, editandoItbis])

  // Total del documento = bienes + ITBIS. Es lo que se guarda como
  // valor_original en TCXP_DOCUMENTO (mismo semántico que el legado).
  const totalDocumento = Number(form.valor_bienes || 0) + Number(impuesto || 0)

  const onSave = async () => {
    if (!punto) {
      toast.error('Seleccione un punto de trabajo')
      return
    }
    if (!tipoDocu || !proveedor?.no_proveedor || !form.valor_bienes) {
      toast.error('Tipo de documento, proveedor y valor de bienes son requeridos')
      return
    }
    setSaving(true)
    try {
      const res = await api.cxpEntradaDocumento({
        no_cia: noCia,
        punto,
        tipo_docu: tipoDocu,
        no_proveedor: proveedor.no_proveedor,
        ...form,
        // valor_original = bienes + ITBIS (total del documento)
        valor_original: Number(form.valor_bienes) + Number(impuesto || 0),
        impuesto: Number(impuesto || 0),
        isc:             form.isc             ? Number(form.isc)             : 0,
        otros_impuestos: form.otros_impuestos ? Number(form.otros_impuestos) : 0,
        propina:         form.propina         ? Number(form.propina)         : 0,
        tipo_retencion:  form.tipo_retencion  ? Number(form.tipo_retencion)  : null,
        itbis_retenido:  form.itbis_retenido  ? Number(form.itbis_retenido)  : 0,
        isr_retenido:    form.isr_retenido    ? Number(form.isr_retenido)    : 0,
        forma_pago:      form.forma_pago      ? Number(form.forma_pago)      : null,
      })
      const retTxt = (Number(form.itbis_retenido || 0) > 0 || Number(form.isr_retenido || 0) > 0)
        ? ` — Retenido ITBIS RD$ ${Number(form.itbis_retenido || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })} / ISR RD$ ${Number(form.isr_retenido || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`
        : ''
      toast.success(`Documento ${res.no_docu} creado (ITBIS RD$ ${Number(impuesto || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })})${retTxt}`)
      setProveedor(null)
      // reset preservando los defaults del catálogo
      const defRet = tiposRetencion.find((r) => r.por_defecto === 'S')
      const defFp  = formasPago.find((r) => r.por_defecto === 'S')
      setForm({
        fecha: today,
        fecha_vence: '',
        valor_bienes: '',
        descripcion: '',
        rnc: '',
        ncf: '',
        tipo_ncf: '',
        isc: '',
        otros_impuestos: '',
        propina: '',
        tipo_gasto: '',
        tipo_retencion: defRet ? String(defRet.tipo_retencion) : '',
        itbis_retenido: '',
        isr_retenido: '',
        forma_pago:    defFp  ? String(defFp.forma_pago) : '',
      })
      setImpuesto('')
      setEditandoItbis(false)
      const next = await api.cxpGetSiguienteNoDocu(noCia, punto, tipoDocu)
      setSiguiente(next.siguiente || '')
    } catch (e: any) {
      toast.error(e?.message || 'Error guardando documento')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='space-y-4 p-6'>
      <h1 className='text-2xl font-semibold'>
        FCXP201 — Entrada de Documentos DR/CR
      </h1>
      <Card>
        <CardContent className='grid grid-cols-1 gap-3 pt-6 md:grid-cols-3'>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>Tipo Documento *</Label>
            <Select value={tipoDocu} onValueChange={setTipoDocu}>
              <SelectTrigger className='h-10 w-full'>
                <SelectValue placeholder='Seleccione…' />
              </SelectTrigger>
              <SelectContent>
                {tiposDocu.map((t: any) => (
                  <SelectItem
                    key={t.codigo ?? t.tipo_docu}
                    value={t.codigo ?? t.tipo_docu}
                  >
                    {t.codigo ?? t.tipo_docu} — {t.nombre ?? t.descripcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>Siguiente No.</Label>
            <Input value={siguiente} disabled className='h-10 font-mono' />
          </div>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>Fecha *</Label>
            <Input
              type='date'
              value={form.fecha}
              onChange={(e) =>
                setForm((f) => ({ ...f, fecha: e.target.value }))
              }
              className='h-10'
            />
          </div>

          <ProveedorPicker value={proveedor} onChange={setProveedor} />

          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>RNC</Label>
            <Input
              value={form.rnc}
              onChange={(e) => setForm((f) => ({ ...f, rnc: e.target.value }))}
              className='h-10 font-mono'
            />
          </div>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs flex items-center justify-between'>
              <span>NCF</span>
              {ncfInfo?.codigo_ncf && (
                <span className='inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800'>
                  Auto {ncfInfo.posiciones_fijas} — {ncfInfo.descripcion}
                </span>
              )}
            </Label>
            <div className='flex gap-1'>
              <Select
                value={form.tipo_ncf || (ncfInfo?.posiciones_fijas ?? '')}
                onValueChange={(v) => setForm((f) => ({ ...f, tipo_ncf: v }))}
                disabled={!!ncfInfo?.codigo_ncf}
              >
                <SelectTrigger className='h-10 w-[88px] font-mono'>
                  <SelectValue placeholder='B0X' />
                </SelectTrigger>
                <SelectContent>
                  {['B01','B02','B03','B04','B11','B13','B14','B15','E31','E32'].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={form.ncf}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 8)
                  setForm((f) => ({ ...f, ncf: raw }))
                }}
                onBlur={() => {
                  const n = (form.ncf || '').replace(/[^0-9]/g, '')
                  if (n) setForm((f) => ({ ...f, ncf: n.padStart(8, '0') }))
                }}
                className='h-10 font-mono flex-1'
                placeholder={ncfInfo?.codigo_ncf ? 'auto' : 'ej. 281'}
                inputMode='numeric'
                maxLength={8}
              />
            </div>
            {form.ncf && (
              <div className='text-[10px] text-muted-foreground font-mono'>
                NCF DGI: {(form.tipo_ncf || ncfInfo?.posiciones_fijas || '').toUpperCase()}{form.ncf.padStart(8, '0')}
              </div>
            )}
          </div>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>Valor de Bienes (sin ITBIS) *</Label>
            <Input
              type='number'
              step='0.01'
              value={form.valor_bienes}
              onChange={(e) =>
                setForm((f) => ({ ...f, valor_bienes: e.target.value }))
              }
              className='h-10 text-right font-mono'
            />
          </div>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs flex items-center justify-between'>
              <span>ITBIS ({porcItbis}%)</span>
              <button type='button' onClick={() => setEditandoItbis(!editandoItbis)}
                className='text-[10px] text-emerald-700 hover:underline'>
                {editandoItbis ? 'auto' : 'editar'}
              </button>
            </Label>
            <Input
              type='number'
              step='0.01'
              value={impuesto}
              onChange={(e) => { setEditandoItbis(true); setImpuesto(e.target.value) }}
              className='h-10 text-right font-mono'
              placeholder='auto'
            />
            {form.valor_bienes && (
              <div className='text-[10px] font-semibold text-emerald-700'>
                Total a registrar (con ITBIS): RD$ {totalDocumento.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            )}
          </div>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>Fecha Vence</Label>
            <Input
              type='date'
              value={form.fecha_vence}
              onChange={(e) =>
                setForm((f) => ({ ...f, fecha_vence: e.target.value }))
              }
              className='h-10'
            />
          </div>
          <div className='space-y-1 md:col-span-3'>
            <Label className='text-xs'>Descripción</Label>
            <Input
              value={form.descripcion}
              onChange={(e) =>
                setForm((f) => ({ ...f, descripcion: e.target.value }))
              }
              className='h-10'
            />
          </div>

          {/* Impuestos/cargos adicionales DGI */}
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>ISC (Selectivo)</Label>
            <Input
              type='number' step='0.01' placeholder='0.00'
              value={form.isc}
              onChange={(e) => setForm((f) => ({ ...f, isc: e.target.value }))}
              className='h-10 text-right font-mono'
            />
          </div>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>Otros Impuestos</Label>
            <Input
              type='number' step='0.01' placeholder='0.00'
              value={form.otros_impuestos}
              onChange={(e) => setForm((f) => ({ ...f, otros_impuestos: e.target.value }))}
              className='h-10 text-right font-mono'
            />
          </div>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>Propina Legal</Label>
            <Input
              type='number' step='0.01' placeholder='0.00'
              value={form.propina}
              onChange={(e) => setForm((f) => ({ ...f, propina: e.target.value }))}
              className='h-10 text-right font-mono'
            />
          </div>

          {/* Clasificaciones DGI 606/607 */}
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>Tipo de Gasto (DGI)</Label>
            <Select
              value={form.tipo_gasto}
              onValueChange={(v) => setForm((f) => ({ ...f, tipo_gasto: v === '__none__' ? '' : v }))}
            >
              <SelectTrigger className='h-10 w-full'>
                <SelectValue placeholder='Sin clasificar' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='__none__'>— Sin clasificar —</SelectItem>
                {tiposGasto.map((t) => (
                  <SelectItem key={t.tipo_gasto} value={t.tipo_gasto}>
                    {t.tipo_gasto} — {t.descripcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>Tipo de Retención</Label>
            <Select
              value={form.tipo_retencion}
              onValueChange={(v) => setForm((f) => ({ ...f, tipo_retencion: v === '__none__' ? '' : v }))}
            >
              <SelectTrigger className='h-10 w-full'>
                <SelectValue placeholder='Ninguna' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='__none__'>— Ninguna —</SelectItem>
                {tiposRetencion.map((t) => (
                  <SelectItem key={t.tipo_retencion} value={String(t.tipo_retencion)}>
                    {t.tipo_retencion} — {t.descripcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs flex items-center justify-between'>
              <span>ITBIS Retenido</span>
              {Number(impuesto || 0) > 0 && (
                <button
                  type='button'
                  onClick={() => setForm((f) => ({ ...f, itbis_retenido: impuesto }))}
                  className='text-[10px] text-emerald-700 hover:underline'
                >
                  100% (RD$ {Number(impuesto).toLocaleString('es-DO', { minimumFractionDigits: 2 })})
                </button>
              )}
            </Label>
            <Input
              type='number' step='0.01' placeholder='0.00'
              value={form.itbis_retenido}
              onChange={(e) => setForm((f) => ({ ...f, itbis_retenido: e.target.value }))}
              className='h-10 text-right font-mono'
            />
          </div>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>ISR Retenido</Label>
            <Input
              type='number' step='0.01' placeholder='0.00'
              value={form.isr_retenido}
              onChange={(e) => setForm((f) => ({ ...f, isr_retenido: e.target.value }))}
              className='h-10 text-right font-mono'
            />
          </div>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>Forma de Pago</Label>
            <Select
              value={form.forma_pago}
              onValueChange={(v) => setForm((f) => ({ ...f, forma_pago: v === '__none__' ? '' : v }))}
            >
              <SelectTrigger className='h-10 w-full'>
                <SelectValue placeholder='No especificada' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='__none__'>— No especificada —</SelectItem>
                {formasPago.map((f) => (
                  <SelectItem key={f.forma_pago} value={String(f.forma_pago)}>
                    {f.forma_pago} — {f.descripcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {cuentaProveedor && (
            <div className='space-y-1 md:col-span-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm'>
              <span className='text-xs text-emerald-700'>Cuenta contable destino: </span>
              <span className='font-mono font-semibold text-emerald-900'>{cuentaProveedor.cuenta}</span>
              {cuentaProveedor.nombre && (
                <span className='ml-2 text-emerald-800'>· {cuentaProveedor.nombre}</span>
              )}
              {cuentaProveedor.cuenta_prima && (
                <span className='ml-2 text-xs text-emerald-700'>(prima: <span className='font-mono'>{cuentaProveedor.cuenta_prima}</span>)</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <div className='flex justify-end gap-2'>
        <Button onClick={onSave} disabled={saving}>
          <Save className='mr-2 h-4 w-4' />{' '}
          {saving ? 'Guardando…' : 'Guardar Documento'}
        </Button>
      </div>
    </div>
  )
}

// ─── FCXP204 — Reversar Documento ────────────────────────────────────────────
const STATUS_DOC: Record<string, { label: string; variant: any }> = {
  A: { label: 'Activo', variant: 'default' },
  C: { label: 'Cerrado', variant: 'outline' },
  R: { label: 'Reversado', variant: 'destructive' },
}

export function CxpReversar({ noCia, punto = '' }: P) {
  const [tipoDocu, setTipoDocu] = useState('')
  const [noDocu, setNoDocu] = useState('')
  const [tiposDocu, setTiposDocu] = useState<any[]>([])
  const [doc, setDoc] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [motivo, setMotivo] = useState('')

  useEffect(() => {
    api
      .cxpListTiposDocu(noCia)
      .then(setTiposDocu)
      .catch(() => {})
  }, [noCia])

  // NO_DOCU en TCXP_DOCUMENTO es CHAR(7): "8347" → "0008347"
  const normNoDocu = (v: string) => {
    const n = v.trim()
    return /^\d+$/.test(n) ? n.padStart(7, '0') : n
  }

  const buscar = async () => {
    if (!tipoDocu || !noDocu.trim())
      return toast.error('Tipo y No. de documento son requeridos')
    if (!punto) return toast.error('Seleccione un punto de trabajo')
    const nd = normNoDocu(noDocu)
    setNoDocu(nd)
    try {
      const d = await api.cxpGetDocumento(noCia, punto, tipoDocu, nd)
      setDoc(d)
    } catch (e: any) {
      toast.error(
        e?.message === 'not found' || e?.status === 404
          ? `No existe el documento ${tipoDocu}-${nd} en este punto.`
          : e?.message || `No existe el documento ${tipoDocu}-${nd} en este punto.`
      )
      setDoc(null)
    }
  }

  const reversar = async () => {
    if (!doc) return
    setBusy(true)
    try {
      const res: any = await api.cxpReversarDocumento({
        no_cia: noCia,
        punto,
        tipo_docu: tipoDocu,
        no_docu: normNoDocu(noDocu),
        motivo: motivo.trim(),
      })
      const ajuste = res?.nota_debito || res?.nota_credito
      const ajusteTxt = ajuste
        ? ` — generó ${res?.nota_debito ? 'Nota de Débito' : 'Nota de Crédito'} ${ajuste.tipo_docu}-${ajuste.no_docu} (RD$ ${Number(ajuste.monto).toLocaleString('es-DO', { minimumFractionDigits: 2 })})`
        : ''
      toast.success(`Documento ${tipoDocu}-${normNoDocu(noDocu)} reversado${ajusteTxt}`)
      setDoc(null)
      setNoDocu('')
      setMotivo('')
      setConfirming(false)
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo reversar el documento')
    } finally {
      setBusy(false)
    }
  }

  const st = doc ? STATUS_DOC[doc.status] || { label: doc.status, variant: 'secondary' } : null

  return (
    <div className='space-y-4 p-4 md:p-6'>
      <div>
        <h1 className='text-2xl font-semibold'>Reversar Documento</h1>
        <p className='text-sm text-muted-foreground'>
          Busca un documento activo y reviértelo (queda con estado Reversado y
          saldo 0). El sistema genera automáticamente la Nota de Débito o
          Crédito de ajuste que lo contrarresta y queda aplicada contra el
          documento original.
        </p>
      </div>
      <Card>
        <CardContent className='flex flex-wrap items-end gap-3 pt-6'>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>Tipo</Label>
            <Select value={tipoDocu} onValueChange={setTipoDocu}>
              <SelectTrigger className='h-9 w-56'>
                <SelectValue placeholder='Tipo…' />
              </SelectTrigger>
              <SelectContent>
                {tiposDocu.map((t: any) => (
                  <SelectItem
                    key={t.codigo ?? t.tipo_docu}
                    value={t.codigo ?? t.tipo_docu}
                  >
                    {t.codigo ?? t.tipo_docu} — {t.nombre ?? t.descripcion}
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
              placeholder='ej. 8347'
            />
          </div>
          <Button onClick={buscar} size='sm' variant='outline'>
            <Search className='mr-2 h-4 w-4' />
            Buscar
          </Button>
        </CardContent>
      </Card>
      {doc && (
        <Card>
          <CardContent className='space-y-3 pt-6'>
            <div className='grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 md:grid-cols-3'>
              <div>
                <b>Proveedor:</b> {doc.no_proveedor} — {doc.nombre_proveedor}
              </div>
              <div>
                <b>Fecha:</b> {doc.fecha}
              </div>
              <div>
                <b>Valor:</b>{' '}
                <span className='font-mono tabular-nums'>RD$ {fmt(doc.valor_original)}</span>
              </div>
              <div>
                <b>Saldo:</b>{' '}
                <span className='font-mono tabular-nums'>RD$ {fmt(doc.saldo)}</span>
              </div>
              <div>
                <b>NCF:</b>{' '}
                <span className='font-mono'>{ncfDgi(doc) || '—'}</span>
              </div>
              <div>
                <b>Estado:</b> <Badge variant={st!.variant}>{st!.label}</Badge>
              </div>
            </div>
            <div className='flex justify-end'>
              <Button
                variant='destructive'
                onClick={() => setConfirming(true)}
                disabled={busy || doc.status === 'R' || doc.status === 'C'}
              >
                <RotateCcw className='mr-2 h-4 w-4' />
                Reversar
              </Button>
            </div>
            {doc.status === 'C' && (
              <p className='text-right text-xs text-muted-foreground'>
                Documento cerrado: ya fue actualizado y no se puede reversar.
              </p>
            )}
          </CardContent>
        </Card>
      )}
      <Dialog open={confirming} onOpenChange={(o) => !busy && setConfirming(o)}>
        <DialogContent className='h-auto max-h-[80vh] max-w-md overflow-y-auto sm:max-h-[80vh]'>
          <DialogHeader>
            <DialogTitle>
              Reversar {tipoDocu}-{normNoDocu(noDocu)}
            </DialogTitle>
          </DialogHeader>
          <div className='space-y-3'>
            <p className='text-sm text-muted-foreground'>
              El documento quedará con estado <b>Reversado</b> y saldo RD$ 0.00.
              Se generará automáticamente la Nota de Débito/Crédito de ajuste
              aplicada contra este documento. Solo es posible si aún no se ha
              generado al mayor.
            </p>
            <div className='min-w-0 space-y-1'>
              <Label className='text-xs'>Motivo *</Label>
              <Input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value.slice(0, 60))}
                placeholder='ej. digitado con NCF equivocado'
                maxLength={60}
              />
            </div>
            <div className='flex justify-end gap-2 pt-2'>
              <Button variant='outline' onClick={() => setConfirming(false)} disabled={busy}>
                Cancelar
              </Button>
              <Button
                variant='destructive'
                onClick={reversar}
                disabled={busy || !motivo.trim()}
              >
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

// ─── FCXP205 — Liberar Débito ────────────────────────────────────────────────
export function CxpLiberarDebito({ noCia, punto = '' }: P) {
  const [noProv, setNoProv] = useState('')
  const [docs, setDocs] = useState<any[]>([])
  const [crSelected, setCrSelected] = useState<any | null>(null)
  const [debitos, setDebitos] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)

  const cargar = async () => {
    if (!punto) return toast.error('Seleccione un punto de trabajo')
    setBusy(true)
    try {
      const rows = await api.cxpLiberarDebitoGet(noCia, punto, noProv)
      setDocs(rows)
    } catch (e: any) {
      toast.error(e?.message || 'Error')
    } finally {
      setBusy(false)
    }
  }

  const creditos = docs.filter(
    (d: any) =>
      Number(d.tipo_movi || '') === 2 || /(NC|CR|PAGO)/i.test(d.tipo_docu || '')
  )
  const debitosDocs = docs.filter((d: any) => !creditos.includes(d))

  const totalDeb = Object.values(debitos).reduce((s, v) => s + (v || 0), 0)

  const aplicar = async () => {
    if (!crSelected) return toast.error('Seleccione un crédito')
    const items = Object.entries(debitos)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => {
        const [tipo_docu, no_docu] = k.split(':')
        return { tipo_docu, no_docu, monto: v }
      })
    if (!items.length) return toast.error('Indique al menos un monto')
    if (
      !confirm(
        `¿Aplicar ${fmt(totalDeb)} del crédito ${crSelected.tipo_docu}-${crSelected.no_docu}?`
      )
    )
      return
    setBusy(true)
    try {
      await api.cxpLiberarDebitoPost({
        no_cia: noCia,
        punto,
        no_docu_cr: crSelected.no_docu,
        tipo_docu_cr: crSelected.tipo_docu,
        debitos: items,
      })
      toast.success('Aplicación registrada')
      setDebitos({})
      await cargar()
    } catch (e: any) {
      toast.error(e?.message || 'Error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='space-y-4 p-6'>
      <h1 className='text-2xl font-semibold'>
        FCXP205 — Liberar Débito (Aplicar Crédito)
      </h1>
      <Card>
        <CardContent className='flex flex-wrap items-end gap-3 pt-6'>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>No. Proveedor</Label>
            <Input
              value={noProv}
              onChange={(e) => setNoProv(e.target.value)}
              className='h-9 w-40 font-mono'
            />
          </div>
          <Button onClick={cargar} disabled={busy}>
            <Search className='mr-2 h-4 w-4' />
            Cargar
          </Button>
        </CardContent>
      </Card>
      {docs.length > 0 && (
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
          <Card>
            <CardContent className='pt-6'>
              <h3 className='mb-2 font-semibold'>Créditos disponibles</h3>
              <div className='overflow-x-auto rounded border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-16'></TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>No.</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className='text-right'>Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creditos.map((d: any) => (
                      <TableRow
                        key={`${d.tipo_docu}:${d.no_docu}`}
                        onClick={() => setCrSelected(d)}
                        className={`cursor-pointer ${crSelected?.no_docu === d.no_docu ? 'bg-emerald-50' : ''}`}
                      >
                        <TableCell>
                          <input
                            type='radio'
                            checked={crSelected?.no_docu === d.no_docu}
                            readOnly
                          />
                        </TableCell>
                        <TableCell className='font-mono text-sm'>
                          {d.tipo_docu}
                        </TableCell>
                        <TableCell className='font-mono text-sm'>
                          {d.no_docu}
                        </TableCell>
                        <TableCell className='text-sm'>{d.fecha}</TableCell>
                        <TableCell className='text-right'>
                          {fmt(d.saldo)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {creditos.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className='py-4 text-center text-muted-foreground'
                        >
                          Sin créditos
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className='pt-6'>
              <h3 className='mb-2 font-semibold'>Débitos a aplicar</h3>
              <div className='overflow-x-auto rounded border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>No.</TableHead>
                      <TableHead className='text-right'>Saldo</TableHead>
                      <TableHead className='text-right'>Aplicar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {debitosDocs.map((d: any) => {
                      const k = `${d.tipo_docu}:${d.no_docu}`
                      return (
                        <TableRow key={k}>
                          <TableCell className='font-mono text-sm'>
                            {d.tipo_docu}
                          </TableCell>
                          <TableCell className='font-mono text-sm'>
                            {d.no_docu}
                          </TableCell>
                          <TableCell className='text-right'>
                            {fmt(d.saldo)}
                          </TableCell>
                          <TableCell className='text-right'>
                            <Input
                              type='number'
                              step='0.01'
                              value={debitos[k] || ''}
                              onChange={(e) =>
                                setDebitos((s) => ({
                                  ...s,
                                  [k]: Number(e.target.value),
                                }))
                              }
                              className='ml-auto h-7 w-24 text-right font-mono'
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {debitosDocs.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className='py-4 text-center text-muted-foreground'
                        >
                          Sin débitos
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className='mt-3 text-right text-sm'>
                Total a aplicar: <b>{fmt(totalDeb)}</b>
              </div>
              <div className='mt-3 flex justify-end'>
                <Button
                  onClick={aplicar}
                  disabled={busy || !crSelected || totalDeb <= 0}
                >
                  <Save className='mr-2 h-4 w-4' /> Aplicar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// ─── FCXP206 — Bloquear/Desbloquear Pago ─────────────────────────────────────
export function CxpBloquearPago({ noCia, punto = '' }: P) {
  const [tipoDocu, setTipoDocu] = useState('')
  const [noDocu, setNoDocu] = useState('')
  const [tiposDocu, setTiposDocu] = useState<any[]>([])
  const [doc, setDoc] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .cxpListTiposDocu(noCia)
      .then(setTiposDocu)
      .catch(() => {})
  }, [noCia])

  const buscar = async () => {
    if (!tipoDocu || !noDocu) return toast.error('Tipo y No. son requeridos')
    if (!punto) return toast.error('Seleccione un punto de trabajo')
    try {
      const d = await api.cxpGetDocumento(noCia, punto, tipoDocu, noDocu)
      setDoc(d)
    } catch (e: any) {
      toast.error(e?.message || 'Documento no encontrado')
      setDoc(null)
    }
  }

  const toggle = async (bloquear: boolean) => {
    if (!doc) return
    setBusy(true)
    try {
      await api.cxpBloquearPago({
        no_cia: noCia,
        punto,
        tipo_docu: tipoDocu,
        no_docu: noDocu,
        bloquear,
      })
      toast.success(bloquear ? 'Pago bloqueado' : 'Pago desbloqueado')
      buscar()
    } catch (e: any) {
      toast.error(e?.message || 'Error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='space-y-4 p-6'>
      <h1 className='text-2xl font-semibold'>
        FCXP206 — Bloquear / Desbloquear Pago
      </h1>
      <Card>
        <CardContent className='flex flex-wrap items-end gap-3 pt-6'>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>Tipo</Label>
            <Select value={tipoDocu} onValueChange={setTipoDocu}>
              <SelectTrigger className='h-9 w-40'>
                <SelectValue placeholder='Tipo…' />
              </SelectTrigger>
              <SelectContent>
                {tiposDocu.map((t: any) => (
                  <SelectItem
                    key={t.codigo ?? t.tipo_docu}
                    value={t.codigo ?? t.tipo_docu}
                  >
                    {t.codigo ?? t.tipo_docu} — {t.nombre ?? t.descripcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>No.</Label>
            <Input
              value={noDocu}
              onChange={(e) => setNoDocu(e.target.value)}
              className='h-9 w-40 font-mono'
            />
          </div>
          <Button onClick={buscar} variant='outline'>
            <Search className='mr-2 h-4 w-4' />
            Buscar
          </Button>
        </CardContent>
      </Card>
      {doc && (
        <Card>
          <CardContent className='space-y-3 pt-6'>
            <div className='grid grid-cols-2 gap-3 text-sm md:grid-cols-4'>
              <div>
                <b>Proveedor:</b> {doc.no_proveedor} — {doc.nombre_proveedor}
              </div>
              <div>
                <b>Fecha:</b> {doc.fecha}
              </div>
              <div>
                <b>Valor:</b> {fmt(doc.valor_original)}
              </div>
              <div>
                <b>Saldo:</b> {fmt(doc.saldo)}
              </div>
              <div>
                <b>NCF:</b>{' '}
                <span className='font-mono'>{ncfDgi(doc) || '—'}</span>
              </div>
              <div>
                <b>Pago:</b>
                {doc.pago_bloqueado === 'S' ? (
                  <Badge variant='destructive' className='ml-2'>
                    <Lock className='mr-1 h-3 w-3' /> Bloqueado
                  </Badge>
                ) : (
                  <Badge className='ml-2'>
                    <Unlock className='mr-1 h-3 w-3' /> Desbloqueado
                  </Badge>
                )}
              </div>
            </div>
            <div className='flex justify-end gap-2'>
              {doc.pago_bloqueado === 'S' ? (
                <Button onClick={() => toggle(false)} disabled={busy}>
                  <Unlock className='mr-2 h-4 w-4' /> Desbloquear
                </Button>
              ) : (
                <Button
                  variant='destructive'
                  onClick={() => toggle(true)}
                  disabled={busy}
                >
                  <Lock className='mr-2 h-4 w-4' /> Bloquear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Hook período activo (TCXP_PUNTO) ────────────────────────────────────────
const MESES_CXP = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function usePeriodoCxP(noCia: string, punto: string) {
  return useQuery({
    queryKey: ['cxp-punto', noCia, punto],
    queryFn: async () => {
      const all = await api.cxpListPuntos(noCia)
      return (all as any[]).find((p) => String(p.punto) === String(punto)) || null
    },
    enabled: !!noCia && !!punto,
  })
}

// ─── Imprimir Asiento Contable (FCXP301) ─────────────────────────────────────
export function CxpAsientoContable({ noCia, punto = '' }: P) {
  const periodoQ = usePeriodoCxP(noCia, punto)
  const [mesVal, setMesVal] = useState(curMonth)
  const [anoVal, setAnoVal] = useState(curYear)
  const [tipoImpresion, setTipoImpresion] = useState<'detallado' | 'diario'>('detallado')

  useMemo(() => {
    if (periodoQ.data) {
      setMesVal(periodoQ.data.mes_proceso || curMonth)
      setAnoVal(periodoQ.data.ano_proceso || curYear)
    }
  }, [periodoQ.data])

  const cargarMut = useMutation({
    mutationFn: () => {
      if (!punto) throw new Error('Seleccione un punto de trabajo')
      return api.cxpAsientoContable(noCia, punto, mesVal, anoVal)
    },
    onError: (e: any) => toast.error(e?.detail?.error || e?.message || 'Error'),
  })

  const rows: any[] = (cargarMut.data as any[]) ?? []
  const totalDebito = rows.reduce((s, r) => s + (Number(r.total_debito) || 0), 0)
  const totalCredito = rows.reduce((s, r) => s + (Number(r.total_credito) || 0), 0)
  const balanceado = Math.abs(totalDebito - totalCredito) < 0.001

  const printPdf = async () => {
    if (!rows.length) return
    const meta = await buildReportMeta(noCia, punto, `${String(mesVal).padStart(2, '0')}-${anoVal}`)
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<html><head><title>Asiento Contable CxP</title>
      <style>body{font-family:Arial,sans-serif;font-size:9pt}table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #333;padding:4px 7px}th{background:#0F172A;color:#fff}
      .r{text-align:right}.tot{font-weight:700;background:#f1f5f9}</style></head>
      <body><h3>${meta.company}</h3>
      <p><b>Asiento Contable CxP</b> — ${MESES_CXP[mesVal - 1]} ${anoVal} · Tipo: ${tipoImpresion}</p>
      <table><thead><tr><th>Cuenta</th><th>Centro Costo</th><th class=r>Débito</th><th class=r>Crédito</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${r.cuenta}</td><td>${r.centro_costo || ''}</td>
        <td class=r>${Number(r.total_debito) > 0 ? fmt(r.total_debito) : ''}</td>
        <td class=r>${Number(r.total_credito) > 0 ? fmt(r.total_credito) : ''}</td></tr>`).join('')}
        <tr class=tot><td colspan=2>TOTALES</td><td class=r>${fmt(totalDebito)}</td>
        <td class=r>${fmt(totalCredito)}</td></tr></tbody></table></body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 300)
  }

  return (
    <div className='p-6 space-y-4 max-w-4xl mx-auto'>
      <Card>
        <CardHeader className='pb-3'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <CardTitle className='text-lg'>Imprimir Asiento Contable</CardTitle>
              <p className='text-xs text-muted-foreground mt-0.5'>
                Resumen del asiento contable de Cuentas por Pagar por cuenta del período seleccionado.
              </p>
            </div>
            <PeriodoBadge
              mes={periodoQ.data?.mes_proceso}
              ano={periodoQ.data?.ano_proceso}
              loading={periodoQ.isLoading}
            />
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-3 gap-3'>
            <div className='space-y-1.5'>
              <Label className='text-xs'>Mes</Label>
              <Select value={String(mesVal)} onValueChange={(v) => setMesVal(Number(v))}>
                <SelectTrigger className='h-9'><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES_CXP.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{i + 1} — {m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label className='text-xs'>Año</Label>
              <Input type='number' min={2000} max={2099} value={anoVal}
                onChange={(e) => setAnoVal(Number(e.target.value))} className='h-9' />
            </div>
            <div className='space-y-1.5'>
              <Label className='text-xs'>Tipo de impresión</Label>
              <Select value={tipoImpresion} onValueChange={(v) => setTipoImpresion(v as any)}>
                <SelectTrigger className='h-9'><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='detallado'>Soporte detallado</SelectItem>
                  <SelectItem value='diario'>Entrada de diario</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className='flex gap-2'>
            <Button onClick={() => cargarMut.mutate()} variant='secondary' disabled={cargarMut.isPending}>
              {cargarMut.isPending ? 'Cargando…' : 'Previsualizar'}
            </Button>
            <Button onClick={printPdf} disabled={!rows.length} className='gap-1'>
              <Printer className='h-4 w-4' /> Imprimir
            </Button>
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader className='pb-2'>
            <div className='flex items-center justify-between'>
              <CardTitle className='text-base'>Previsualización</CardTitle>
              {balanceado
                ? <Badge variant='default' className='bg-green-600'>Balanceado</Badge>
                : <Badge variant='destructive'>Desbalanceado</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            <div className='border rounded-lg overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow className='bg-muted/40'>
                    <TableHead>Cuenta</TableHead>
                    <TableHead className='w-32'>Centro Costo</TableHead>
                    <TableHead className='w-36 text-right'>Débito</TableHead>
                    <TableHead className='w-36 text-right'>Crédito</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className='font-mono text-xs'>{r.cuenta}</TableCell>
                      <TableCell className='font-mono text-xs'>{r.centro_costo}</TableCell>
                      <TableCell className='text-right tabular-nums'>
                        {Number(r.total_debito) > 0 ? fmt(r.total_debito) : ''}
                      </TableCell>
                      <TableCell className='text-right tabular-nums'>
                        {Number(r.total_credito) > 0 ? fmt(r.total_credito) : ''}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className='font-bold bg-muted/60 border-t-2'>
                    <TableCell colSpan={2}>TOTALES</TableCell>
                    <TableCell className='text-right tabular-nums'>RD$ {fmt(totalDebito)}</TableCell>
                    <TableCell className='text-right tabular-nums'>RD$ {fmt(totalCredito)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Generar Asiento al Mayor (FCXP302) ──────────────────────────────────────
export function CxpGenerarAsiento({ noCia, punto = '' }: P) {
  const periodoQ = usePeriodoCxP(noCia, punto)
  const [mesProceso, setMesProceso] = useState<number | null>(null)
  const [anoProceso, setAnoProceso] = useState<number | null>(null)
  const [fecha, setFecha] = useState(today)

  useMemo(() => {
    if (periodoQ.data && mesProceso === null) {
      setMesProceso(periodoQ.data.mes_proceso || curMonth)
      setAnoProceso(periodoQ.data.ano_proceso || curYear)
    }
  }, [periodoQ.data, mesProceso])

  const generarMut = useMutation({
    mutationFn: () => {
      if (!punto) throw new Error('Seleccione un punto de trabajo')
      return api.cxpGenerarAsiento({
        no_cia: noCia,
        punto,
        mes_proceso: mesProceso!,
        ano_proceso: anoProceso!,
      })
    },
    onSuccess: () =>
      toast.success(`Asiento generado para ${String(mesProceso).padStart(2, '0')}/${anoProceso}`),
    onError: (e: any) => toast.error(e?.detail?.error || e?.message || 'Error al generar el asiento'),
  })

  const ejecutar = () => {
    if (!confirm('¿Generar asiento al mayor? Esta operación es irreversible.')) return
    generarMut.mutate()
  }

  if (periodoQ.isLoading || mesProceso === null) {
    return <div className='p-6 text-muted-foreground'>Cargando período…</div>
  }

  return (
    <div className='p-6 space-y-4 max-w-2xl mx-auto'>
      <Card>
        <CardHeader className='pb-3'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <CardTitle className='text-lg'>Generar Asiento al Mayor</CardTitle>
              <p className='text-xs text-muted-foreground mt-0.5'>
                Marca los documentos de CxP del mes como contabilizados y los envía a Contabilidad.
              </p>
            </div>
            <PeriodoBadge
              mes={periodoQ.data?.mes_proceso}
              ano={periodoQ.data?.ano_proceso}
              loading={periodoQ.isLoading}
            />
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <AlertIrreversible tone='amber'>
            Esta operación marca los documentos como generados en contabilidad y NO puede deshacerse.
            Asegúrese de haber revisado el asiento contable previamente.
          </AlertIrreversible>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label className='text-xs'>Período de Proceso</Label>
              <div className='flex gap-2'>
                <Select value={String(mesProceso)} onValueChange={(v) => setMesProceso(Number(v))}>
                  <SelectTrigger className='h-9'><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESES_CXP.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type='number' min={2000} max={2099} value={anoProceso || ''}
                  onChange={(e) => setAnoProceso(Number(e.target.value))} className='h-9 w-24' />
              </div>
            </div>
            <div className='space-y-1.5'>
              <Label className='text-xs'>Fecha del Asiento</Label>
              <Input type='date' value={fecha} onChange={(e) => setFecha(e.target.value)} className='h-9' />
            </div>
          </div>

          <Button onClick={ejecutar} disabled={generarMut.isPending} className='w-full gap-2'>
            <ChevronRight className='h-4 w-4' />
            {generarMut.isPending ? 'Generando…' : 'Generar Asiento'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Cierre Mensual de CxP (FCXP303) ─────────────────────────────────────────
export function CxpCierre({ noCia, punto = '' }: P) {
  const periodoQ = usePeriodoCxP(noCia, punto)
  const [fecha, setFecha] = useState(today)

  const cerrarMut = useMutation({
    mutationFn: () => {
      if (!punto) throw new Error('Seleccione un punto de trabajo')
      return api.cxpCierre({ no_cia: noCia, punto })
    },
    onSuccess: (r: any) => {
      const m = MESES_CXP[(r?.mes || 1) - 1]
      toast.success(`Cierre ejecutado. Nuevo período: ${m} ${r?.ano || ''}`)
    },
    onError: (e: any) => toast.error(e?.detail?.error || e?.message || 'Error al ejecutar el cierre'),
  })

  const ejecutar = () => {
    if (!periodoQ.data) return
    const m = MESES_CXP[(periodoQ.data.mes_proceso || 1) - 1]
    if (!confirm(`¿Ejecutar cierre de CxP para ${m} ${periodoQ.data.ano_proceso}?\n\nEsta operación avanzará el período y NO puede deshacerse.`)) return
    cerrarMut.mutate()
  }

  return (
    <div className='p-6 space-y-4 max-w-xl mx-auto'>
      <Card>
        <CardHeader className='pb-3'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <CardTitle className='text-lg'>Cierre Mensual de Cuentas por Pagar</CardTitle>
              <p className='text-xs text-muted-foreground mt-0.5'>
                Avanza el período activo del módulo al siguiente mes.
              </p>
            </div>
            <PeriodoBadge
              mes={periodoQ.data?.mes_proceso}
              ano={periodoQ.data?.ano_proceso}
              loading={periodoQ.isLoading}
            />
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <AlertIrreversible tone='red'>
            <b>Operación irreversible.</b> Asegúrese de haber generado el asiento contable
            y revisado los reportes del período antes de continuar.
          </AlertIrreversible>

          {periodoQ.data && (
            <div className='grid grid-cols-1 gap-3'>
              <div className='flex items-center justify-between p-3 border rounded bg-muted/40'>
                <span className='text-sm text-muted-foreground'>Período actual</span>
                <span className='font-semibold'>
                  {MESES_CXP[(periodoQ.data.mes_proceso || 1) - 1]} {periodoQ.data.ano_proceso}
                </span>
              </div>
              <div className='space-y-1.5'>
                <Label className='text-xs'>Fecha del cierre</Label>
                <Input type='date' value={fecha} onChange={(e) => setFecha(e.target.value)} className='h-9' />
              </div>
            </div>
          )}

          {cerrarMut.isSuccess && (
            <div className='bg-green-50 border border-green-300 rounded-lg p-3 flex items-center gap-2'>
              <CheckCircle2 className='h-5 w-5 text-green-600 flex-shrink-0' />
              <div className='text-sm text-green-800'>
                Cierre completado. El nuevo período es{' '}
                <b>{MESES_CXP[((cerrarMut.data as any)?.mes || 1) - 1]} {(cerrarMut.data as any)?.ano}</b>
              </div>
            </div>
          )}

          <GuardedButton modulo="cxp" flag="HACER_CIERRE"
                  onClick={ejecutar} disabled={cerrarMut.isPending || !periodoQ.data}
                  variant='destructive' className='w-full gap-2'>
            <CheckCircle2 className='h-4 w-4' />
            {cerrarMut.isPending ? 'Procesando…' : 'Ejecutar Cierre'}
          </GuardedButton>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── RCXP103 — Reporte de Movimientos de Proveedores (por proveedor) ────────
export function CxpRepMovimientos({ noCia, punto = '' }: P) {
  const [noProv, setNoProv] = useState('')
  const [desde, setDesde] = useState(
    `${curYear}-${String(curMonth).padStart(2, '0')}-01`
  )
  const [hasta, setHasta] = useState(today)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const cargar = async () => {
    if (!punto) return toast.error('Seleccione un punto de trabajo')
    if (!noProv) return toast.error('Indique un proveedor')
    setLoading(true)
    try {
      const r = await api.cxpListMovimientosProveedor(
        noProv,
        noCia,
        punto,
        desde,
        hasta
      )
      setRows(r)
    } catch (e: any) {
      toast.error(e?.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  // Normaliza: si backend devuelve debito/credito en 0 pero hay valor_original,
  // derivar por tipo_movi (D=débito al proveedor, C=crédito que reduce saldo).
  const normMov = (r: any) => {
    const d = Number(r.debito || 0)
    const c = Number(r.credito || 0)
    if (d > 0 || c > 0) return { debito: d, credito: c }
    const valor = Number(r.valor_original || 0)
    const tipo = (r.tipo_movi ?? '').toString().toUpperCase()
    return {
      debito: tipo === 'D' ? valor : 0,
      credito: tipo === 'C' ? valor : 0,
    }
  }
  const movs = rows.map((r: any) => ({ ...r, ...normMov(r) }))
  // Saldo acumulado (orden cronológico, débitos suman, créditos restan).
  let saldoAcum = 0
  for (const m of movs) {
    saldoAcum += m.debito - m.credito
    m.saldoAcum = saldoAcum
  }
  const totalDebe = movs.reduce((s, r: any) => s + r.debito, 0)
  const totalHaber = movs.reduce((s, r: any) => s + r.credito, 0)

  return (
    <div className='space-y-4 p-6'>
      <h1 className='text-2xl font-semibold'>
        RCXP103 — Movimientos de Proveedor
      </h1>
      <Card>
        <CardContent className='flex flex-wrap items-end gap-3 pt-6'>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>No. Proveedor</Label>
            <Input
              value={noProv}
              onChange={(e) => setNoProv(e.target.value)}
              className='h-9 w-40 font-mono'
            />
          </div>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>Desde</Label>
            <Input
              type='date'
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className='h-9 w-40'
            />
          </div>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>Hasta</Label>
            <Input
              type='date'
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className='h-9 w-40'
            />
          </div>
          <Button onClick={cargar} disabled={loading}>
            <Search className='mr-2 h-4 w-4' />
            Generar
          </Button>
        </CardContent>
      </Card>
      <div className='overflow-x-auto rounded border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>No.</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>NCF</TableHead>
              <TableHead className='text-right'>Débito</TableHead>
              <TableHead className='text-right'>Crédito</TableHead>
              <TableHead className='text-right'>Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} className='py-6 text-center'>
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!loading && movs.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className='py-6 text-center text-muted-foreground'
                >
                  Sin datos
                </TableCell>
              </TableRow>
            )}
            {movs.map((r: any, i: number) => (
              <TableRow key={i}>
                <TableCell className='font-mono text-sm'>
                  {r.tipo_docu}
                </TableCell>
                <TableCell className='font-mono text-sm'>{r.no_docu}</TableCell>
                <TableCell className='text-sm'>{r.fecha}</TableCell>
                <TableCell className='font-mono text-sm'>
                  {ncfDgi(r) || '—'}
                </TableCell>
                <TableCell className='text-right text-red-700'>
                  {r.debito > 0 ? fmt(r.debito) : ''}
                </TableCell>
                <TableCell className='text-right text-emerald-700'>
                  {r.credito > 0 ? fmt(r.credito) : ''}
                </TableCell>
                <TableCell className='text-right'>{fmt(r.saldoAcum)}</TableCell>
              </TableRow>
            ))}
            {movs.length > 0 && (
              <TableRow className='border-t-2 bg-muted/50 font-bold'>
                <TableCell colSpan={4}>TOTALES</TableCell>
                <TableCell className='text-right text-red-700'>
                  {fmt(totalDebe)}
                </TableCell>
                <TableCell className='text-right text-emerald-700'>
                  {fmt(totalHaber)}
                </TableCell>
                <TableCell className='text-right'>{fmt(saldoAcum)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ─── RCXP105 — Reporte de Cuadre Contable ────────────────────────────────────
export function CxpRepCuadre({ noCia, punto = '' }: P) {
  const [mes, setMes] = useState(curMonth)
  const [ano, setAno] = useState(curYear)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const cargar = async () => {
    if (!punto) return toast.error('Seleccione un punto de trabajo')
    setLoading(true)
    try {
      setData(await api.cxpRepCuadre(noCia, punto, mes, ano))
    } catch (e: any) {
      toast.error(e?.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  const items: any[] = data?.items || []
  const diff = (data?.total_debe || 0) - (data?.total_haber || 0)

  return (
    <div className='space-y-4 p-6'>
      <h1 className='text-2xl font-semibold'>RCXP105 — Cuadre Contable</h1>
      <Card>
        <CardContent className='flex flex-wrap items-end gap-3 pt-6'>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>Mes</Label>
            <Input
              type='number'
              min={1}
              max={12}
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className='h-9 w-20'
            />
          </div>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>Año</Label>
            <Input
              type='number'
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className='h-9 w-28'
            />
          </div>
          <Button onClick={cargar} disabled={loading}>
            <FileText className='mr-2 h-4 w-4' />
            Generar
          </Button>
          <Button
            variant='outline'
            disabled={!data}
            onClick={() => {
              const qs = new URLSearchParams({
                no_cia: noCia, punto, mes: String(mes), ano: String(ano),
              }).toString()
              window.open(`/print/cxp-rep-cuadre/current?${qs}`, '_blank')
            }}
          >
            <Printer className='mr-2 h-4 w-4' />
            Imprimir PDF
          </Button>
        </CardContent>
      </Card>
      {data && (
        <div className='flex flex-wrap gap-x-6 gap-y-1 rounded border bg-muted/20 p-3 text-sm'>
          <span>
            Cuentas: <b>{items.length}</b>
          </span>
          <span>
            Debe: <b>{fmt(data.total_debe)}</b>
          </span>
          <span>
            Haber: <b>{fmt(data.total_haber)}</b>
          </span>
          <span>
            Diferencia:{' '}
            <b
              className={
                Math.abs(diff) < 0.01 ? 'text-emerald-700' : 'text-red-700'
              }
            >
              {fmt(diff)}
            </b>
          </span>
        </div>
      )}
      <div className='overflow-x-auto rounded border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuenta</TableHead>
              <TableHead className='w-24 text-right'>Docs.</TableHead>
              <TableHead className='w-36 text-right'>Debe</TableHead>
              <TableHead className='w-36 text-right'>Haber</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={4} className='py-6 text-center'>
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className='py-6 text-center text-muted-foreground'
                >
                  Sin datos del periodo
                </TableCell>
              </TableRow>
            )}
            {items.map((r: any, i: number) => (
              <TableRow key={i}>
                <TableCell className='font-mono text-sm'>{r.cuenta}</TableCell>
                <TableCell className='text-right'>{r.docs}</TableCell>
                <TableCell className='text-right'>
                  {r.debe > 0 ? fmt(r.debe) : ''}
                </TableCell>
                <TableCell className='text-right'>
                  {r.haber > 0 ? fmt(r.haber) : ''}
                </TableCell>
              </TableRow>
            ))}
            {items.length > 0 && (
              <TableRow className='border-t-2 bg-muted/50 font-bold'>
                <TableCell colSpan={2}>TOTALES</TableCell>
                <TableCell className='text-right'>
                  {fmt(data.total_debe)}
                </TableCell>
                <TableCell className='text-right'>
                  {fmt(data.total_haber)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ─── RCXP108 — Certificado de Retenciones a Proveedores ──────────────────────
export function CxpRepRetenciones({ noCia, punto = '' }: P) {
  const [ano, setAno] = useState(curYear)
  const [noProv, setNoProv] = useState('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const cargar = async () => {
    if (!punto) return toast.error('Seleccione un punto de trabajo')
    setLoading(true)
    try {
      setData(await api.cxpRepRetenciones(noCia, punto, ano, noProv))
    } catch (e: any) {
      toast.error(e?.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  const proveedores: any[] = data?.proveedores || []

  return (
    <div className='space-y-4 p-6'>
      <h1 className='text-2xl font-semibold'>
        RCXP108 — Certificado Retención de Proveedores
      </h1>
      <Card>
        <CardContent className='flex flex-wrap items-end gap-3 pt-6'>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>Año</Label>
            <Input
              type='number'
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className='h-9 w-28'
            />
          </div>
          <div className='min-w-0 space-y-1'>
            <Label className='text-xs'>Proveedor (opcional)</Label>
            <Input
              value={noProv}
              onChange={(e) => setNoProv(e.target.value)}
              placeholder='Todos…'
              className='h-9 w-40 font-mono'
            />
          </div>
          <Button onClick={cargar} disabled={loading}>
            <FileText className='mr-2 h-4 w-4' />
            Generar
          </Button>
          <Button
            variant='outline'
            disabled={!data}
            onClick={() => {
              const qs = new URLSearchParams({
                no_cia: noCia, punto, ano: String(ano),
                ...(noProv && { no_proveedor: noProv }),
              }).toString()
              window.open(`/print/cxp-rep-retenciones/current?${qs}`, '_blank')
            }}
          >
            <Printer className='mr-2 h-4 w-4' />
            Imprimir PDF
          </Button>
        </CardContent>
      </Card>
      {data && (
        <div className='flex flex-wrap gap-x-6 gap-y-1 rounded border bg-muted/20 p-3 text-sm'>
          <span>
            Proveedores: <b>{proveedores.length}</b>
          </span>
          <span>
            Documentos: <b>{data.count_docs}</b>
          </span>
          <span>
            ITBIS retenido: <b>{fmt(data.total_itbis)}</b>
          </span>
          <span>
            ISR retenido: <b>{fmt(data.total_isr)}</b>
          </span>
        </div>
      )}
      <div className='space-y-3'>
        {loading && (
          <Card>
            <CardContent className='py-8 text-center'>Cargando…</CardContent>
          </Card>
        )}
        {!loading && proveedores.length === 0 && data && (
          <Card>
            <CardContent className='py-8 text-center text-muted-foreground'>
              Sin retenciones para el periodo
            </CardContent>
          </Card>
        )}
        {proveedores.map((p: any) => (
          <Card key={p.no_proveedor}>
            <CardContent className='space-y-2 pt-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <div className='font-semibold'>
                    {p.no_proveedor} — {p.nombre_proveedor}
                  </div>
                  <div className='text-xs text-muted-foreground'>
                    RNC: {p.rnc_proveedor || '—'}
                  </div>
                </div>
                <div className='text-right text-sm'>
                  <div>
                    ITBIS Ret.: <b>{fmt(p.total_itbis)}</b>
                  </div>
                  <div>
                    ISR Ret.: <b>{fmt(p.total_isr)}</b>
                  </div>
                </div>
              </div>
              <div className='overflow-x-auto rounded border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>No.</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>NCF</TableHead>
                      <TableHead className='text-right'>Monto</TableHead>
                      <TableHead className='text-right'>ITBIS</TableHead>
                      <TableHead className='text-right'>ISR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(p.documentos || []).map((d: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className='font-mono text-sm'>
                          {d.tipo_docu}
                        </TableCell>
                        <TableCell className='font-mono text-sm'>
                          {d.no_docu}
                        </TableCell>
                        <TableCell className='text-sm'>
                          {(d.fecha || '').slice(0, 10)}
                        </TableCell>
                        <TableCell className='font-mono text-sm'>
                          {ncfDgi(d) || '—'}
                        </TableCell>
                        <TableCell className='text-right'>
                          {fmt(d.valor_original)}
                        </TableCell>
                        <TableCell className='text-right text-orange-700'>
                          {d.itbis_retenido > 0 ? fmt(d.itbis_retenido) : ''}
                        </TableCell>
                        <TableCell className='text-right text-red-700'>
                          {d.isr_retenido > 0 ? fmt(d.isr_retenido) : ''}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
