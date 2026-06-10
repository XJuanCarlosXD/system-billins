// CxP Procesos: entrada-documentos, reversar, liberar-debito, bloquear-pago,
// asiento-contable, generar-asiento, cierre.
//
// Cada componente conecta a un endpoint ya existente en apps/legacy/cxp_views.py.
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Save, RotateCcw, Lock, Unlock, FileText, Play, AlertTriangle, Search,
} from 'lucide-react'
import { regalGeneralApi as api } from '@/lib/regal-general-api'

interface P { noCia: string; punto?: string }

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
function ProveedorPicker({
  value, onChange,
}: {
  value: { no_proveedor: string; nombre: string; rnc: string; direccion: string } | null
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

  useEffect(() => { setCodigo(value?.no_proveedor ?? '') }, [value?.no_proveedor])

  const cargarPorCodigo = async (cod: string) => {
    const trimmed = cod.trim()
    if (!trimmed) { onChange(null); return }
    setLoadingCode(true)
    try {
      const p = await api.cxpGetProveedor(trimmed)
      if (p && p.no_proveedor) onChange(p)
      else { toast.error(`Proveedor ${trimmed} no encontrado`); onChange(null) }
    } catch {
      toast.error(`Proveedor ${trimmed} no encontrado`)
      onChange(null)
    } finally { setLoadingCode(false) }
  }

  const buscar = async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const rows = await api.cxpListProveedores({ search: q, activo: 'S' })
      setResults(rows)
    } catch { setResults([]) }
    finally { setSearching(false) }
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
      <div className='space-y-1 w-36'>
        <Label className='text-xs'>Código Proveedor *</Label>
        <Input
          ref={inputRef}
          value={codigo}
          onChange={e => { setCodigo(e.target.value); if (value) onChange(null) }}
          onBlur={e => cargarPorCodigo(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') cargarPorCodigo(codigo) }}
          placeholder='Código'
          disabled={loadingCode}
          className='h-10 font-mono'
        />
      </div>
      <Button variant='outline' onClick={abrirModal} className='h-10 px-3' type='button' title='Buscar proveedor'>
        <Search className='h-4 w-4' />
      </Button>
      {value ? (
        <div className='flex-1 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 flex items-center gap-6 flex-wrap'>
          <div className='min-w-0'>
            <span className='block text-xs text-emerald-600 font-medium'>Nombre</span>
            <span className='font-semibold text-emerald-900 truncate block'>{value.nombre}</span>
          </div>
          {value.rnc && (
            <div className='shrink-0'>
              <span className='block text-xs text-emerald-600 font-medium'>RNC / Cédula</span>
              <span className='font-mono text-emerald-800 text-sm'>{value.rnc}</span>
            </div>
          )}
          {value.direccion && (
            <div className='min-w-0'>
              <span className='block text-xs text-emerald-600 font-medium'>Dirección</span>
              <span className='text-emerald-700 text-sm truncate block'>{value.direccion}</span>
            </div>
          )}
          <Button size='sm' variant='ghost' onClick={() => { onChange(null); setCodigo('') }} className='shrink-0 text-gray-400 hover:text-red-500 ml-auto'>
            Cambiar
          </Button>
        </div>
      ) : (
        <div className='flex-1 flex items-center px-3 py-2 rounded-lg border border-dashed border-gray-300 text-sm text-gray-400 h-10'>
          {loadingCode ? 'Cargando proveedor…' : 'Ingrese código o use la lupa para buscar'}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='w-[60vw] h-[70vh] max-w-none sm:max-w-none flex flex-col p-0 gap-0 overflow-hidden'>
          <DialogHeader className='px-6 py-4 border-b shrink-0'>
            <DialogTitle>Buscar Proveedor</DialogTitle>
          </DialogHeader>
          <div className='px-6 py-3 border-b shrink-0 bg-gray-50'>
            <Input
              ref={searchInputRef}
              value={search}
              onChange={e => { setSearch(e.target.value); buscar(e.target.value) }}
              placeholder='Buscar por nombre, código o RNC…'
              className='text-base h-11'
              autoFocus
            />
          </div>
          <div className='flex-1 overflow-y-auto px-6 py-2'>
            <Table>
              <TableHeader className='sticky top-0 bg-white z-10'>
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
                    <TableCell colSpan={5} className='text-center text-gray-400 py-12'>
                      {searching ? 'Buscando…' : search.length >= 2 ? 'Sin resultados' : 'Escriba al menos 2 caracteres'}
                    </TableCell>
                  </TableRow>
                )}
                {results.map((p: any) => (
                  <TableRow key={p.no_proveedor} className='hover:bg-blue-50 cursor-pointer' onDoubleClick={() => aplicar(p)}>
                    <TableCell className='font-mono font-semibold'>{p.no_proveedor}</TableCell>
                    <TableCell className='font-medium'>{p.nombre}</TableCell>
                    <TableCell className='font-mono text-sm'>{p.rnc || p.cedula || '—'}</TableCell>
                    <TableCell className='text-sm text-gray-600 truncate max-w-xs'>{p.direccion || '—'}</TableCell>
                    <TableCell className='text-center'>
                      <Button size='sm' className='h-7 px-3' onClick={() => aplicar(p)}>Seleccionar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className='px-6 py-3 border-t shrink-0 bg-gray-50 flex items-center justify-between text-sm text-gray-500'>
            <span>{results.length > 0 ? `${results.length} proveedor${results.length !== 1 ? 'es' : ''} encontrado${results.length !== 1 ? 's' : ''}` : ''}</span>
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
    valor_original: '',
    descripcion: '',
    rnc: '',
    ncf: '',
    tipo_ncf: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.cxpListTiposDocu(noCia).then(setTiposDocu).catch(() => {})
  }, [noCia])

  useEffect(() => {
    if (!tipoDocu || !punto) { setSiguiente(''); return }
    api.cxpGetSiguienteNoDocu(noCia, punto, tipoDocu)
      .then(r => setSiguiente(r.siguiente || ''))
      .catch(() => setSiguiente(''))
  }, [tipoDocu, noCia, punto])

  // Cuando se carga un proveedor, traer su RNC por defecto.
  useEffect(() => {
    if (proveedor?.rnc) setForm(f => ({ ...f, rnc: proveedor.rnc }))
  }, [proveedor?.no_proveedor])  // eslint-disable-line react-hooks/exhaustive-deps

  const onSave = async () => {
    if (!punto) { toast.error('Seleccione un punto de trabajo'); return }
    if (!tipoDocu || !proveedor?.no_proveedor || !form.valor_original) {
      toast.error('Tipo de documento, proveedor y valor son requeridos')
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
        valor_original: Number(form.valor_original),
      })
      toast.success(`Documento ${res.no_docu} creado`)
      setProveedor(null)
      setForm({
        fecha: today, fecha_vence: '', valor_original: '',
        descripcion: '', rnc: '', ncf: '', tipo_ncf: '',
      })
      const next = await api.cxpGetSiguienteNoDocu(noCia, punto, tipoDocu)
      setSiguiente(next.siguiente || '')
    } catch (e: any) {
      toast.error(e?.message || 'Error guardando documento')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='p-6 space-y-4'>
      <h1 className='text-2xl font-semibold'>FCXP201 — Entrada de Documentos DR/CR</h1>
      <Card>
        <CardContent className='pt-6 grid grid-cols-1 md:grid-cols-3 gap-3'>
          <div className='space-y-1'>
            <Label className='text-xs'>Tipo Documento *</Label>
            <Select value={tipoDocu} onValueChange={setTipoDocu}>
              <SelectTrigger className='h-10'><SelectValue placeholder='Seleccione…' /></SelectTrigger>
              <SelectContent>
                {tiposDocu.map((t: any) => (
                  <SelectItem key={t.codigo ?? t.tipo_docu} value={t.codigo ?? t.tipo_docu}>
                    {(t.codigo ?? t.tipo_docu)} — {(t.nombre ?? t.descripcion)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1'>
            <Label className='text-xs'>Siguiente No.</Label>
            <Input value={siguiente} disabled className='h-10 font-mono' />
          </div>
          <div className='space-y-1'>
            <Label className='text-xs'>Fecha *</Label>
            <Input type='date' value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} className='h-10' />
          </div>

          <ProveedorPicker value={proveedor} onChange={setProveedor} />

          <div className='space-y-1'>
            <Label className='text-xs'>RNC</Label>
            <Input value={form.rnc} onChange={e => setForm(f => ({ ...f, rnc: e.target.value }))} className='h-10 font-mono' />
          </div>
          <div className='space-y-1'>
            <Label className='text-xs'>NCF</Label>
            <Input value={form.ncf} onChange={e => setForm(f => ({ ...f, ncf: e.target.value }))} className='h-10 font-mono' placeholder='B01...' />
          </div>
          <div className='space-y-1'>
            <Label className='text-xs'>Valor Original *</Label>
            <Input type='number' step='0.01' value={form.valor_original}
              onChange={e => setForm(f => ({ ...f, valor_original: e.target.value }))} className='h-10 text-right font-mono' />
          </div>
          <div className='space-y-1'>
            <Label className='text-xs'>Fecha Vence</Label>
            <Input type='date' value={form.fecha_vence}
              onChange={e => setForm(f => ({ ...f, fecha_vence: e.target.value }))} className='h-10' />
          </div>
          <div className='space-y-1 md:col-span-3'>
            <Label className='text-xs'>Descripción</Label>
            <Input value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} className='h-10' />
          </div>
        </CardContent>
      </Card>
      <div className='flex justify-end gap-2'>
        <Button onClick={onSave} disabled={saving}>
          <Save className='h-4 w-4 mr-2' /> {saving ? 'Guardando…' : 'Guardar Documento'}
        </Button>
      </div>
    </div>
  )
}

// ─── FCXP204 — Reversar Documento ────────────────────────────────────────────
export function CxpReversar({ noCia, punto = '' }: P) {
  const [tipoDocu, setTipoDocu] = useState('')
  const [noDocu, setNoDocu] = useState('')
  const [tiposDocu, setTiposDocu] = useState<any[]>([])
  const [doc, setDoc] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { api.cxpListTiposDocu(noCia).then(setTiposDocu).catch(() => {}) }, [noCia])

  const buscar = async () => {
    if (!tipoDocu || !noDocu) return toast.error('Tipo y No. de documento son requeridos')
    if (!punto) return toast.error('Seleccione un punto de trabajo')
    try {
      const d = await api.cxpGetDocumento(noCia, punto, tipoDocu, noDocu)
      setDoc(d)
    } catch (e: any) {
      toast.error(e?.message || 'Documento no encontrado')
      setDoc(null)
    }
  }

  const reversar = async () => {
    if (!doc) return
    if (!confirm(`¿Reversar documento ${tipoDocu}-${noDocu}? Esta acción es reversible solo si no se ha generado al mayor.`)) return
    setBusy(true)
    try {
      await api.cxpReversarDocumento({ no_cia: noCia, punto, tipo_docu: tipoDocu, no_docu: noDocu })
      toast.success('Documento reversado')
      setDoc(null); setNoDocu('')
    } catch (e: any) {
      toast.error(e?.message || 'Error reversando')
    } finally { setBusy(false) }
  }

  return (
    <div className='p-6 space-y-4'>
      <h1 className='text-2xl font-semibold'>FCXP204 — Reversar Documento</h1>
      <Card>
        <CardContent className='pt-6 flex gap-3 flex-wrap items-end'>
          <div className='space-y-1'>
            <Label className='text-xs'>Tipo</Label>
            <Select value={tipoDocu} onValueChange={setTipoDocu}>
              <SelectTrigger className='h-9 w-40'><SelectValue placeholder='Tipo…' /></SelectTrigger>
              <SelectContent>
                {tiposDocu.map((t: any) => (
                  <SelectItem key={t.codigo ?? t.tipo_docu} value={t.codigo ?? t.tipo_docu}>
                    {(t.codigo ?? t.tipo_docu)} — {(t.nombre ?? t.descripcion)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1'>
            <Label className='text-xs'>No. Documento</Label>
            <Input value={noDocu} onChange={e => setNoDocu(e.target.value)} className='h-9 w-40 font-mono' />
          </div>
          <Button onClick={buscar} size='sm' variant='outline'><Search className='h-4 w-4 mr-2' />Buscar</Button>
        </CardContent>
      </Card>
      {doc && (
        <Card>
          <CardContent className='pt-6 space-y-3'>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-3 text-sm'>
              <div><b>Proveedor:</b> {doc.no_proveedor} — {doc.nombre_proveedor}</div>
              <div><b>Fecha:</b> {doc.fecha}</div>
              <div><b>Valor:</b> {fmt(doc.valor_original)}</div>
              <div><b>Saldo:</b> {fmt(doc.saldo)}</div>
              <div><b>NCF:</b> <span className='font-mono'>{ncfDgi(doc) || '—'}</span></div>
              <div><b>Estado:</b> <Badge variant={doc.status === 'R' ? 'destructive' : 'default'}>{doc.status}</Badge></div>
            </div>
            <div className='flex justify-end'>
              <Button variant='destructive' onClick={reversar} disabled={busy || doc.status === 'R'}>
                <RotateCcw className='h-4 w-4 mr-2' /> {busy ? 'Reversando…' : 'Reversar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
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
    } catch (e: any) { toast.error(e?.message || 'Error') }
    finally { setBusy(false) }
  }

  const creditos = docs.filter((d: any) => Number(d.tipo_movi || '') === 2 || /(NC|CR|PAGO)/i.test(d.tipo_docu || ''))
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
    if (!confirm(`¿Aplicar ${fmt(totalDeb)} del crédito ${crSelected.tipo_docu}-${crSelected.no_docu}?`)) return
    setBusy(true)
    try {
      await api.cxpLiberarDebitoPost({
        no_cia: noCia, punto,
        no_docu_cr: crSelected.no_docu, tipo_docu_cr: crSelected.tipo_docu,
        debitos: items,
      })
      toast.success('Aplicación registrada')
      setDebitos({})
      await cargar()
    } catch (e: any) { toast.error(e?.message || 'Error') }
    finally { setBusy(false) }
  }

  return (
    <div className='p-6 space-y-4'>
      <h1 className='text-2xl font-semibold'>FCXP205 — Liberar Débito (Aplicar Crédito)</h1>
      <Card>
        <CardContent className='pt-6 flex gap-3 items-end'>
          <div className='space-y-1'>
            <Label className='text-xs'>No. Proveedor</Label>
            <Input value={noProv} onChange={e => setNoProv(e.target.value)} className='h-9 w-40 font-mono' />
          </div>
          <Button onClick={cargar} disabled={busy}><Search className='h-4 w-4 mr-2' />Cargar</Button>
        </CardContent>
      </Card>
      {docs.length > 0 && (
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
          <Card>
            <CardContent className='pt-6'>
              <h3 className='font-semibold mb-2'>Créditos disponibles</h3>
              <div className='border rounded'>
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
                      <TableRow key={`${d.tipo_docu}:${d.no_docu}`}
                        onClick={() => setCrSelected(d)}
                        className={`cursor-pointer ${crSelected?.no_docu === d.no_docu ? 'bg-emerald-50' : ''}`}>
                        <TableCell><input type='radio' checked={crSelected?.no_docu === d.no_docu} readOnly /></TableCell>
                        <TableCell className='font-mono text-sm'>{d.tipo_docu}</TableCell>
                        <TableCell className='font-mono text-sm'>{d.no_docu}</TableCell>
                        <TableCell className='text-sm'>{d.fecha}</TableCell>
                        <TableCell className='text-right'>{fmt(d.saldo)}</TableCell>
                      </TableRow>
                    ))}
                    {creditos.length === 0 && <TableRow><TableCell colSpan={5} className='text-center text-muted-foreground py-4'>Sin créditos</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className='pt-6'>
              <h3 className='font-semibold mb-2'>Débitos a aplicar</h3>
              <div className='border rounded'>
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
                          <TableCell className='font-mono text-sm'>{d.tipo_docu}</TableCell>
                          <TableCell className='font-mono text-sm'>{d.no_docu}</TableCell>
                          <TableCell className='text-right'>{fmt(d.saldo)}</TableCell>
                          <TableCell className='text-right'>
                            <Input type='number' step='0.01'
                              value={debitos[k] || ''}
                              onChange={e => setDebitos(s => ({ ...s, [k]: Number(e.target.value) }))}
                              className='h-7 w-24 text-right font-mono ml-auto' />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {debitosDocs.length === 0 && <TableRow><TableCell colSpan={4} className='text-center text-muted-foreground py-4'>Sin débitos</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
              <div className='mt-3 text-right text-sm'>
                Total a aplicar: <b>{fmt(totalDeb)}</b>
              </div>
              <div className='mt-3 flex justify-end'>
                <Button onClick={aplicar} disabled={busy || !crSelected || totalDeb <= 0}>
                  <Save className='h-4 w-4 mr-2' /> Aplicar
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

  useEffect(() => { api.cxpListTiposDocu(noCia).then(setTiposDocu).catch(() => {}) }, [noCia])

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
      await api.cxpBloquearPago({ no_cia: noCia, punto, tipo_docu: tipoDocu, no_docu: noDocu, bloquear })
      toast.success(bloquear ? 'Pago bloqueado' : 'Pago desbloqueado')
      buscar()
    } catch (e: any) { toast.error(e?.message || 'Error') }
    finally { setBusy(false) }
  }

  return (
    <div className='p-6 space-y-4'>
      <h1 className='text-2xl font-semibold'>FCXP206 — Bloquear / Desbloquear Pago</h1>
      <Card>
        <CardContent className='pt-6 flex gap-3 items-end flex-wrap'>
          <div className='space-y-1'>
            <Label className='text-xs'>Tipo</Label>
            <Select value={tipoDocu} onValueChange={setTipoDocu}>
              <SelectTrigger className='h-9 w-40'><SelectValue placeholder='Tipo…' /></SelectTrigger>
              <SelectContent>
                {tiposDocu.map((t: any) => (
                  <SelectItem key={t.codigo ?? t.tipo_docu} value={t.codigo ?? t.tipo_docu}>
                    {(t.codigo ?? t.tipo_docu)} — {(t.nombre ?? t.descripcion)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1'>
            <Label className='text-xs'>No.</Label>
            <Input value={noDocu} onChange={e => setNoDocu(e.target.value)} className='h-9 w-40 font-mono' />
          </div>
          <Button onClick={buscar} variant='outline'><Search className='h-4 w-4 mr-2' />Buscar</Button>
        </CardContent>
      </Card>
      {doc && (
        <Card>
          <CardContent className='pt-6 space-y-3'>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-3 text-sm'>
              <div><b>Proveedor:</b> {doc.no_proveedor} — {doc.nombre_proveedor}</div>
              <div><b>Fecha:</b> {doc.fecha}</div>
              <div><b>Valor:</b> {fmt(doc.valor_original)}</div>
              <div><b>Saldo:</b> {fmt(doc.saldo)}</div>
              <div><b>NCF:</b> <span className='font-mono'>{ncfDgi(doc) || '—'}</span></div>
              <div><b>Pago:</b>
                {doc.pago_bloqueado === 'S'
                  ? <Badge variant='destructive' className='ml-2'><Lock className='h-3 w-3 mr-1' /> Bloqueado</Badge>
                  : <Badge className='ml-2'><Unlock className='h-3 w-3 mr-1' /> Desbloqueado</Badge>}
              </div>
            </div>
            <div className='flex justify-end gap-2'>
              {doc.pago_bloqueado === 'S' ? (
                <Button onClick={() => toggle(false)} disabled={busy}>
                  <Unlock className='h-4 w-4 mr-2' /> Desbloquear
                </Button>
              ) : (
                <Button variant='destructive' onClick={() => toggle(true)} disabled={busy}>
                  <Lock className='h-4 w-4 mr-2' /> Bloquear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── FCXP301 — Imprimir Asiento Contable ─────────────────────────────────────
export function CxpAsientoContable({ noCia, punto = '' }: P) {
  const [mes, setMes] = useState(curMonth)
  const [ano, setAno] = useState(curYear)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const cargar = async () => {
    if (!punto) return toast.error('Seleccione un punto de trabajo')
    setLoading(true)
    try { setItems(await api.cxpAsientoContable(noCia, punto, mes, ano)) }
    catch (e: any) { toast.error(e?.message || 'Error') }
    finally { setLoading(false) }
  }

  // Backend cxp_repo.get_asiento_contable_cxp devuelve:
  //   { cuenta, centro_costo, tipo_movi, total_debito, total_credito }
  // Tolerante a otros nombres por si cambia el shape.
  const norm = (r: any) => {
    const tipo = (r.tipo_movi ?? '').toString().toUpperCase()
    const monto = Number(r.monto ?? r.valor ?? 0)
    const debe = r.total_debito != null ? Number(r.total_debito)
      : r.debe != null ? Number(r.debe)
      : (tipo === 'D' ? monto : 0)
    const haber = r.total_credito != null ? Number(r.total_credito)
      : r.haber != null ? Number(r.haber)
      : (tipo === 'C' ? monto : 0)
    return {
      cuenta: r.cuenta ?? '',
      descripcion: r.descripcion ?? r.cuenta_desc ?? (r.centro_costo && r.centro_costo !== '0000000000' ? `CC ${r.centro_costo}` : ''),
      debe, haber,
    }
  }
  const rows = items.map(norm)
  const totalDebe = rows.reduce((s, r) => s + r.debe, 0)
  const totalHaber = rows.reduce((s, r) => s + r.haber, 0)

  return (
    <div className='p-6 space-y-4'>
      <h1 className='text-2xl font-semibold'>FCXP301 — Imprimir Asiento Contable</h1>
      <Card>
        <CardContent className='pt-6 flex gap-3 items-end flex-wrap'>
          <div className='space-y-1'>
            <Label className='text-xs'>Mes</Label>
            <Input type='number' min={1} max={12} value={mes} onChange={e => setMes(Number(e.target.value))} className='h-9 w-20' />
          </div>
          <div className='space-y-1'>
            <Label className='text-xs'>Año</Label>
            <Input type='number' value={ano} onChange={e => setAno(Number(e.target.value))} className='h-9 w-28' />
          </div>
          <Button onClick={cargar} disabled={loading}><FileText className='h-4 w-4 mr-2' />Generar</Button>
        </CardContent>
      </Card>
      <div className='border rounded'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuenta</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className='text-right'>Debe</TableHead>
              <TableHead className='text-right'>Haber</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={4} className='text-center py-6'>Cargando…</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={4} className='text-center py-6 text-muted-foreground'>Sin datos para el periodo</TableCell></TableRow>}
            {rows.map((r, i: number) => (
              <TableRow key={i}>
                <TableCell className='font-mono text-sm'>{r.cuenta}</TableCell>
                <TableCell className='text-sm'>{r.descripcion}</TableCell>
                <TableCell className='text-right'>{r.debe > 0 ? fmt(r.debe) : ''}</TableCell>
                <TableCell className='text-right'>{r.haber > 0 ? fmt(r.haber) : ''}</TableCell>
              </TableRow>
            ))}
            {rows.length > 0 && (
              <TableRow className='font-bold bg-muted/50 border-t-2'>
                <TableCell colSpan={2}>TOTALES</TableCell>
                <TableCell className='text-right'>{fmt(totalDebe)}</TableCell>
                <TableCell className='text-right'>{fmt(totalHaber)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ─── FCXP302 — Generar Asiento a Contabilidad ────────────────────────────────
export function CxpGenerarAsiento({ noCia, punto = '' }: P) {
  const [mes, setMes] = useState(curMonth)
  const [ano, setAno] = useState(curYear)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)

  const ejecutar = async () => {
    if (!punto) return toast.error('Seleccione un punto de trabajo')
    if (!confirm(`¿Generar asiento al mayor del periodo ${mes}/${ano}? IRREVERSIBLE sobre datos reales.`)) return
    setBusy(true)
    try {
      const r = await api.cxpGenerarAsiento({ no_cia: noCia, punto, mes_proceso: mes, ano_proceso: ano })
      setResult(r)
      toast.success('Asiento generado')
    } catch (e: any) { toast.error(e?.message || 'Error generando asiento') }
    finally { setBusy(false) }
  }

  return (
    <div className='p-6 space-y-4'>
      <h1 className='text-2xl font-semibold'>FCXP302 — Generar Asiento a Contabilidad</h1>
      <Card>
        <CardContent className='pt-6 space-y-3'>
          <div className='flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-3'>
            <AlertTriangle className='h-4 w-4 mt-0.5' />
            <div>Esta acción marca los documentos del periodo como generados al mayor.
              <b> IRREVERSIBLE sobre datos reales.</b></div>
          </div>
          <div className='flex gap-3 items-end flex-wrap'>
            <div className='space-y-1'>
              <Label className='text-xs'>Mes</Label>
              <Input type='number' min={1} max={12} value={mes} onChange={e => setMes(Number(e.target.value))} className='h-9 w-20' />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>Año</Label>
              <Input type='number' value={ano} onChange={e => setAno(Number(e.target.value))} className='h-9 w-28' />
            </div>
            <Button onClick={ejecutar} disabled={busy} variant='destructive'>
              <Play className='h-4 w-4 mr-2' /> {busy ? 'Ejecutando…' : 'Ejecutar'}
            </Button>
          </div>
          {result && (
            <div className='text-sm bg-emerald-50 border border-emerald-200 rounded p-3 mt-2'>
              <b>OK.</b> {JSON.stringify(result)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── FCXP303 — Cierre Mensual ────────────────────────────────────────────────
export function CxpCierre({ noCia, punto = '' }: P) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)

  const ejecutar = async () => {
    if (!punto) return toast.error('Seleccione un punto de trabajo')
    if (!confirm('¿Avanzar el mes de proceso? IRREVERSIBLE sobre datos reales.')) return
    setBusy(true)
    try {
      const r = await api.cxpCierre({ no_cia: noCia, punto })
      setResult(r)
      toast.success('Cierre ejecutado')
    } catch (e: any) { toast.error(e?.message || 'Error') }
    finally { setBusy(false) }
  }

  return (
    <div className='p-6 space-y-4'>
      <h1 className='text-2xl font-semibold'>FCXP303 — Cierre Mensual</h1>
      <Card>
        <CardContent className='pt-6 space-y-3'>
          <div className='flex items-start gap-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded p-3'>
            <AlertTriangle className='h-4 w-4 mt-0.5' />
            <div>Esta acción <b>avanza el mes de proceso</b> en TCXP_PUNTO.
              <b> IRREVERSIBLE sobre datos reales.</b> Asegúrese de haber generado el asiento antes.</div>
          </div>
          <div>
            <Button onClick={ejecutar} disabled={busy} variant='destructive'>
              <Play className='h-4 w-4 mr-2' /> {busy ? 'Ejecutando…' : 'Ejecutar Cierre'}
            </Button>
          </div>
          {result && (
            <div className='text-sm bg-emerald-50 border border-emerald-200 rounded p-3 mt-2'>
              <b>OK.</b> {JSON.stringify(result)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── RCXP103 — Reporte de Movimientos de Proveedores (por proveedor) ────────
export function CxpRepMovimientos({ noCia, punto = '' }: P) {
  const [noProv, setNoProv] = useState('')
  const [desde, setDesde] = useState(`${curYear}-${String(curMonth).padStart(2, '0')}-01`)
  const [hasta, setHasta] = useState(today)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const cargar = async () => {
    if (!punto) return toast.error('Seleccione un punto de trabajo')
    if (!noProv) return toast.error('Indique un proveedor')
    setLoading(true)
    try {
      const r = await api.cxpListMovimientosProveedor(noProv, noCia, punto, desde, hasta)
      setRows(r)
    } catch (e: any) { toast.error(e?.message || 'Error') }
    finally { setLoading(false) }
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
  for (const m of movs) { saldoAcum += (m.debito - m.credito); m.saldoAcum = saldoAcum }
  const totalDebe = movs.reduce((s, r: any) => s + r.debito, 0)
  const totalHaber = movs.reduce((s, r: any) => s + r.credito, 0)

  return (
    <div className='p-6 space-y-4'>
      <h1 className='text-2xl font-semibold'>RCXP103 — Movimientos de Proveedor</h1>
      <Card>
        <CardContent className='pt-6 flex gap-3 items-end flex-wrap'>
          <div className='space-y-1'>
            <Label className='text-xs'>No. Proveedor</Label>
            <Input value={noProv} onChange={e => setNoProv(e.target.value)} className='h-9 w-40 font-mono' />
          </div>
          <div className='space-y-1'>
            <Label className='text-xs'>Desde</Label>
            <Input type='date' value={desde} onChange={e => setDesde(e.target.value)} className='h-9 w-40' />
          </div>
          <div className='space-y-1'>
            <Label className='text-xs'>Hasta</Label>
            <Input type='date' value={hasta} onChange={e => setHasta(e.target.value)} className='h-9 w-40' />
          </div>
          <Button onClick={cargar} disabled={loading}><Search className='h-4 w-4 mr-2' />Generar</Button>
        </CardContent>
      </Card>
      <div className='border rounded'>
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
            {loading && <TableRow><TableCell colSpan={7} className='text-center py-6'>Cargando…</TableCell></TableRow>}
            {!loading && movs.length === 0 && <TableRow><TableCell colSpan={7} className='text-center py-6 text-muted-foreground'>Sin datos</TableCell></TableRow>}
            {movs.map((r: any, i: number) => (
              <TableRow key={i}>
                <TableCell className='font-mono text-sm'>{r.tipo_docu}</TableCell>
                <TableCell className='font-mono text-sm'>{r.no_docu}</TableCell>
                <TableCell className='text-sm'>{r.fecha}</TableCell>
                <TableCell className='font-mono text-sm'>{ncfDgi(r) || '—'}</TableCell>
                <TableCell className='text-right text-red-700'>{r.debito > 0 ? fmt(r.debito) : ''}</TableCell>
                <TableCell className='text-right text-emerald-700'>{r.credito > 0 ? fmt(r.credito) : ''}</TableCell>
                <TableCell className='text-right'>{fmt(r.saldoAcum)}</TableCell>
              </TableRow>
            ))}
            {movs.length > 0 && (
              <TableRow className='font-bold bg-muted/50 border-t-2'>
                <TableCell colSpan={4}>TOTALES</TableCell>
                <TableCell className='text-right text-red-700'>{fmt(totalDebe)}</TableCell>
                <TableCell className='text-right text-emerald-700'>{fmt(totalHaber)}</TableCell>
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
    try { setData(await api.cxpRepCuadre(noCia, punto, mes, ano)) }
    catch (e: any) { toast.error(e?.message || 'Error') }
    finally { setLoading(false) }
  }

  const items: any[] = data?.items || []
  const diff = (data?.total_debe || 0) - (data?.total_haber || 0)

  return (
    <div className='p-6 space-y-4'>
      <h1 className='text-2xl font-semibold'>RCXP105 — Cuadre Contable</h1>
      <Card>
        <CardContent className='pt-6 flex gap-3 items-end flex-wrap'>
          <div className='space-y-1'>
            <Label className='text-xs'>Mes</Label>
            <Input type='number' min={1} max={12} value={mes} onChange={e => setMes(Number(e.target.value))} className='h-9 w-20' />
          </div>
          <div className='space-y-1'>
            <Label className='text-xs'>Año</Label>
            <Input type='number' value={ano} onChange={e => setAno(Number(e.target.value))} className='h-9 w-28' />
          </div>
          <Button onClick={cargar} disabled={loading}><FileText className='h-4 w-4 mr-2' />Generar</Button>
        </CardContent>
      </Card>
      {data && (
        <div className='flex gap-6 text-sm border rounded p-3 bg-muted/20'>
          <span>Cuentas: <b>{items.length}</b></span>
          <span>Debe: <b>{fmt(data.total_debe)}</b></span>
          <span>Haber: <b>{fmt(data.total_haber)}</b></span>
          <span>Diferencia: <b className={Math.abs(diff) < 0.01 ? 'text-emerald-700' : 'text-red-700'}>{fmt(diff)}</b></span>
        </div>
      )}
      <div className='border rounded'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuenta</TableHead>
              <TableHead className='text-right w-24'>Docs.</TableHead>
              <TableHead className='text-right w-36'>Debe</TableHead>
              <TableHead className='text-right w-36'>Haber</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={4} className='text-center py-6'>Cargando…</TableCell></TableRow>}
            {!loading && items.length === 0 && <TableRow><TableCell colSpan={4} className='text-center py-6 text-muted-foreground'>Sin datos del periodo</TableCell></TableRow>}
            {items.map((r: any, i: number) => (
              <TableRow key={i}>
                <TableCell className='font-mono text-sm'>{r.cuenta}</TableCell>
                <TableCell className='text-right'>{r.docs}</TableCell>
                <TableCell className='text-right'>{r.debe > 0 ? fmt(r.debe) : ''}</TableCell>
                <TableCell className='text-right'>{r.haber > 0 ? fmt(r.haber) : ''}</TableCell>
              </TableRow>
            ))}
            {items.length > 0 && (
              <TableRow className='font-bold bg-muted/50 border-t-2'>
                <TableCell colSpan={2}>TOTALES</TableCell>
                <TableCell className='text-right'>{fmt(data.total_debe)}</TableCell>
                <TableCell className='text-right'>{fmt(data.total_haber)}</TableCell>
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
    try { setData(await api.cxpRepRetenciones(noCia, punto, ano, noProv)) }
    catch (e: any) { toast.error(e?.message || 'Error') }
    finally { setLoading(false) }
  }

  const proveedores: any[] = data?.proveedores || []

  return (
    <div className='p-6 space-y-4'>
      <h1 className='text-2xl font-semibold'>RCXP108 — Certificado Retención de Proveedores</h1>
      <Card>
        <CardContent className='pt-6 flex gap-3 items-end flex-wrap'>
          <div className='space-y-1'>
            <Label className='text-xs'>Año</Label>
            <Input type='number' value={ano} onChange={e => setAno(Number(e.target.value))} className='h-9 w-28' />
          </div>
          <div className='space-y-1'>
            <Label className='text-xs'>Proveedor (opcional)</Label>
            <Input value={noProv} onChange={e => setNoProv(e.target.value)} placeholder='Todos…' className='h-9 w-40 font-mono' />
          </div>
          <Button onClick={cargar} disabled={loading}><FileText className='h-4 w-4 mr-2' />Generar</Button>
        </CardContent>
      </Card>
      {data && (
        <div className='flex gap-6 text-sm border rounded p-3 bg-muted/20'>
          <span>Proveedores: <b>{proveedores.length}</b></span>
          <span>Documentos: <b>{data.count_docs}</b></span>
          <span>ITBIS retenido: <b>{fmt(data.total_itbis)}</b></span>
          <span>ISR retenido: <b>{fmt(data.total_isr)}</b></span>
        </div>
      )}
      <div className='space-y-3'>
        {loading && <Card><CardContent className='py-8 text-center'>Cargando…</CardContent></Card>}
        {!loading && proveedores.length === 0 && data && <Card><CardContent className='py-8 text-center text-muted-foreground'>Sin retenciones para el periodo</CardContent></Card>}
        {proveedores.map((p: any) => (
          <Card key={p.no_proveedor}>
            <CardContent className='pt-6 space-y-2'>
              <div className='flex items-center justify-between'>
                <div>
                  <div className='font-semibold'>{p.no_proveedor} — {p.nombre_proveedor}</div>
                  <div className='text-xs text-muted-foreground'>RNC: {p.rnc_proveedor || '—'}</div>
                </div>
                <div className='text-right text-sm'>
                  <div>ITBIS Ret.: <b>{fmt(p.total_itbis)}</b></div>
                  <div>ISR Ret.: <b>{fmt(p.total_isr)}</b></div>
                </div>
              </div>
              <div className='border rounded'>
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
                        <TableCell className='font-mono text-sm'>{d.tipo_docu}</TableCell>
                        <TableCell className='font-mono text-sm'>{d.no_docu}</TableCell>
                        <TableCell className='text-sm'>{(d.fecha || '').slice(0, 10)}</TableCell>
                        <TableCell className='font-mono text-sm'>{ncfDgi(d) || '—'}</TableCell>
                        <TableCell className='text-right'>{fmt(d.valor_original)}</TableCell>
                        <TableCell className='text-right text-orange-700'>{d.itbis_retenido > 0 ? fmt(d.itbis_retenido) : ''}</TableCell>
                        <TableCell className='text-right text-red-700'>{d.isr_retenido > 0 ? fmt(d.isr_retenido) : ''}</TableCell>
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
