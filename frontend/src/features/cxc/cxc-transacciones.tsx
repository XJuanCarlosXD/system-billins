// FCXC201 — Entrada de Transacciones DR/CR
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Trash2, Save } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'

interface P { noCia: string; punto?: string; mes?: number; ano?: number }

interface Linea { cuenta: string; centro_costo: string; debito: number; credito: number; detalle: string }

const BLANK_LINEA: Linea = { cuenta: '', centro_costo: '', debito: 0, credito: 0, detalle: '' }

export function CxcTransacciones({ noCia, punto = '01' }: P) {
  const [tdocus, setTdocus] = useState<any[]>([])
  const [clienteQ, setClienteQ] = useState('')
  const [clienteOpts, setClienteOpts] = useState<any[]>([])
  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    no_cia: noCia, punto,
    tipo_doc: '', no_doc: '', no_cliente: '', nombre_cliente: '',
    fecha: today, valor: 0, detalle: '', ncf: '', ncf_anterior: '',
    tipo_movimiento: 'DR'
  })
  const [lineas, setLineas] = useState<Linea[]>([{ ...BLANK_LINEA }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    regalGeneralApi.cxcListTdocu(noCia).then(setTdocus)
    // Get next doc number
    regalGeneralApi.cxcGetNextDoc(noCia, punto).then(r => setForm(f => ({ ...f, no_doc: r.no_doc })))
  }, [noCia, punto])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const onTipoDocChange = (tipo_doc: string) => {
    const td = tdocus.find(t => t.tipo_doc === tipo_doc)
    set('tipo_doc', tipo_doc)
    if (td) set('tipo_movimiento', td.tipo_movimiento)
  }

  const searchCliente = async () => {
    if (!clienteQ.trim()) return
    const res = await regalGeneralApi.cxcListClientes(noCia, clienteQ, 1)
    setClienteOpts(res.items || [])
  }

  const selectCliente = (c: any) => {
    setForm(f => ({ ...f, no_cliente: c.no_cliente, nombre_cliente: c.nombre_cliente }))
    setClienteOpts([])
    setClienteQ('')
  }

  const setLinea = (i: number, k: keyof Linea, v: any) => {
    const arr = [...lineas]
    arr[i] = { ...arr[i], [k]: v }
    setLineas(arr)
  }

  const addLinea = () => setLineas(l => [...l, { ...BLANK_LINEA }])
  const removeLinea = (i: number) => setLineas(l => l.filter((_, j) => j !== i))

  const totalDebito = lineas.reduce((s, l) => s + Number(l.debito || 0), 0)
  const totalCredito = lineas.reduce((s, l) => s + Number(l.credito || 0), 0)
  const balanced = Math.abs(totalDebito - totalCredito) < 0.001

  const save = async () => {
    setError(''); setSuccess('')
    if (!form.tipo_doc) { setError('Seleccione tipo de documento'); return }
    if (!form.no_cliente) { setError('Seleccione un cliente'); return }
    if (!balanced) { setError(`Asiento desbalanceado: Débitos ${totalDebito.toFixed(2)} ≠ Créditos ${totalCredito.toFixed(2)}`); return }

    setSaving(true)
    try {
      const res = await regalGeneralApi.cxcSaveDocumento({
        ...form, valor: form.valor || totalDebito,
        lineas
      })
      setSuccess(`Documento ${res.no_doc} guardado correctamente`)
      // Reset form, get new doc number
      const nextDoc = await regalGeneralApi.cxcGetNextDoc(noCia, punto)
      setForm(f => ({
        ...f, no_doc: nextDoc.no_doc, no_cliente: '', nombre_cliente: '',
        valor: 0, detalle: '', ncf: '', ncf_anterior: '', fecha: today
      }))
      setLineas([{ ...BLANK_LINEA }])
    } catch (e: any) { setError(e?.message || 'Error al guardar') } finally { setSaving(false) }
  }

  const fmt = (n: number) => n.toLocaleString('es-DO', { minimumFractionDigits: 2 })

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">FCXC201 — Entrada de Transacciones</h1>

      {/* Header */}
      <div className="grid grid-cols-4 gap-4 border rounded-lg p-4 bg-muted/30">
        <div className="space-y-1">
          <Label>No. Cia</Label>
          <Input value={form.no_cia} disabled />
        </div>
        <div className="space-y-1">
          <Label>Punto</Label>
          <Input value={form.punto} disabled />
        </div>
        <div className="space-y-1">
          <Label>Tipo Documento *</Label>
          <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={form.tipo_doc} onChange={e => onTipoDocChange(e.target.value)}>
            <option value="">-- Seleccione --</option>
            {tdocus.filter(t => t.activo === 'S').map(t => (
              <option key={t.tipo_doc} value={t.tipo_doc}>{t.tipo_doc} — {t.descripcion} ({t.tipo_movimiento})</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>No. Documento</Label>
          <Input value={form.no_doc} disabled className="font-mono" />
        </div>
        <div className="space-y-1">
          <Label>Fecha *</Label>
          <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Movimiento</Label>
          <Badge variant={form.tipo_movimiento === 'DR' ? 'default' : 'secondary'} className="h-9 px-4 text-base flex items-center">
            {form.tipo_movimiento === 'DR' ? 'Débito (DR)' : 'Crédito (CR)'}
          </Badge>
        </div>
        <div className="space-y-1">
          <Label>Valor</Label>
          <Input type="number" step="0.01" value={form.valor} onChange={e => set('valor', Number(e.target.value))} />
        </div>
      </div>

      {/* Cliente search */}
      <div className="grid grid-cols-3 gap-4 border rounded-lg p-4 bg-muted/30">
        <div className="space-y-1">
          <Label>Buscar Cliente</Label>
          <div className="flex gap-2">
            <Input value={clienteQ} onChange={e => setClienteQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchCliente()} placeholder="Nombre o código..." />
            <Button onClick={searchCliente} variant="secondary" size="sm">Buscar</Button>
          </div>
          {clienteOpts.length > 0 && (
            <div className="border rounded shadow-md bg-background mt-1 max-h-40 overflow-y-auto z-10 relative">
              {clienteOpts.map(c => (
                <button key={c.no_cliente} onClick={() => selectCliente(c)}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted border-b last:border-0">
                  {c.no_cliente} — {c.nombre_cliente}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <Label>No. Cliente</Label>
          <Input value={form.no_cliente} onChange={e => set('no_cliente', e.target.value)} className="font-mono" />
        </div>
        <div className="space-y-1">
          <Label>Nombre</Label>
          <Input value={form.nombre_cliente} disabled />
        </div>
      </div>

      {/* NCF + Detalle */}
      <div className="grid grid-cols-3 gap-4 border rounded-lg p-4 bg-muted/30">
        <div className="space-y-1">
          <Label>NCF</Label>
          <Input value={form.ncf} onChange={e => set('ncf', e.target.value)} maxLength={19} className="font-mono" />
        </div>
        <div className="space-y-1">
          <Label>NCF Anterior</Label>
          <Input value={form.ncf_anterior} onChange={e => set('ncf_anterior', e.target.value)} maxLength={19} className="font-mono" />
        </div>
        <div className="space-y-1 col-span-3">
          <Label>Detalle / Concepto</Label>
          <Input value={form.detalle} onChange={e => set('detalle', e.target.value)} />
        </div>
      </div>

      {/* Líneas contables */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Líneas Contables</h2>
          <Button size="sm" variant="outline" onClick={addLinea}><Plus className="h-4 w-4 mr-1" />Línea</Button>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuenta</TableHead>
                <TableHead className="w-32">Centro Costo</TableHead>
                <TableHead className="w-36 text-right">Débito</TableHead>
                <TableHead className="w-36 text-right">Crédito</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineas.map((l, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Input value={l.cuenta} onChange={e => setLinea(i, 'cuenta', e.target.value)} className="font-mono h-8" />
                  </TableCell>
                  <TableCell>
                    <Input value={l.centro_costo} onChange={e => setLinea(i, 'centro_costo', e.target.value)} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" value={l.debito || ''} onChange={e => setLinea(i, 'debito', Number(e.target.value))} className="text-right h-8" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" value={l.credito || ''} onChange={e => setLinea(i, 'credito', Number(e.target.value))} className="text-right h-8" />
                  </TableCell>
                  <TableCell>
                    <Input value={l.detalle} onChange={e => setLinea(i, 'detalle', e.target.value)} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeLinea(i)} disabled={lineas.length === 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={2}>TOTALES</TableCell>
                <TableCell className="text-right">{fmt(totalDebito)}</TableCell>
                <TableCell className="text-right">{fmt(totalCredito)}</TableCell>
                <TableCell colSpan={2}>
                  {!balanced && <span className="text-red-500 text-sm">¡Desbalanceado!</span>}
                  {balanced && <span className="text-green-600 text-sm">Balanceado ✓</span>}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
      {success && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded p-2">{success}</p>}

      <div className="flex justify-end gap-2">
        <Button onClick={save} disabled={saving || !balanced} className="gap-2">
          <Save className="h-4 w-4" />{saving ? 'Guardando...' : 'Grabar Documento'}
        </Button>
      </div>
    </div>
  )
}
