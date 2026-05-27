// CXC Procesos: documentos, reversar, pagos masivos, liberar crédito, corregir NCF, cliente-ruta
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, RotateCcw, CreditCard, FileText } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'

interface P { noCia: string; punto?: string; mes?: number; ano?: number }

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })
const today = new Date().toISOString().slice(0, 10)
const firstOfMonth = today.slice(0, 7) + '-01'

// ─── FCXC205 Documentos ───────────────────────────────────────────────────────
export function CxcDocumentos({ noCia, punto }: P) {
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ desde: firstOfMonth, hasta: today, tipo_doc: '', estado: '' })
  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (pg = 1) => {
    setLoading(true)
    try {
      const r = await regalGeneralApi.cxcListDocumentos({ no_cia: noCia, punto, ...filters, page: pg })
      setRows(r.items || []); setTotal(r.count || 0); setPage(pg)
    } finally { setLoading(false) }
  }, [noCia, punto, filters])

  useEffect(() => { load(1) }, [])

  const openDetail = async (row: any) => {
    const d = await regalGeneralApi.cxcGetDocumento(noCia, row.no_doc)
    setDetail(d)
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">FCXC205 — Consulta / Impresión de Documentos</h1>
      <div className="flex flex-wrap gap-3 border rounded-lg p-3 bg-muted/30">
        <div className="space-y-1">
          <Label className="text-xs">Desde</Label>
          <Input type="date" value={filters.desde} onChange={e => setFilters(f => ({ ...f, desde: e.target.value }))} className="h-8 w-36" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hasta</Label>
          <Input type="date" value={filters.hasta} onChange={e => setFilters(f => ({ ...f, hasta: e.target.value }))} className="h-8 w-36" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Estado</Label>
          <select className="flex h-8 rounded-md border border-input bg-background px-3 text-sm"
            value={filters.estado} onChange={e => setFilters(f => ({ ...f, estado: e.target.value }))}>
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagado">Pagado</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={() => load(1)} size="sm" className="h-8 gap-1"><Search className="h-4 w-4" />Buscar</Button>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">{total} documento{total !== 1 ? 's' : ''}</div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">No. Doc</TableHead>
              <TableHead className="w-20">Tipo</TableHead>
              <TableHead className="w-28">Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="w-32 text-right">Valor</TableHead>
              <TableHead className="w-32 text-right">Saldo</TableHead>
              <TableHead className="w-20">Estado</TableHead>
              <TableHead className="w-20">NCF</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={9} className="text-center py-8">Cargando...</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sin documentos</TableCell></TableRow>}
            {rows.map(r => (
              <TableRow key={r.no_doc} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(r)}>
                <TableCell className="font-mono text-sm">{r.no_doc}</TableCell>
                <TableCell><Badge variant="outline">{r.tipo_doc}</Badge></TableCell>
                <TableCell>{r.fecha}</TableCell>
                <TableCell className="max-w-[200px] truncate">{r.nombre_cliente}</TableCell>
                <TableCell className="text-right">{fmt(r.valor)}</TableCell>
                <TableCell className={`text-right font-medium ${Number(r.saldo) > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(r.saldo)}</TableCell>
                <TableCell>
                  <Badge variant={r.estado === 'A' ? 'default' : r.estado === 'R' ? 'destructive' : 'secondary'}>
                    {r.estado === 'A' ? 'Activo' : r.estado === 'R' ? 'Reversado' : r.estado}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{r.ncf}</TableCell>
                <TableCell><FileText className="h-4 w-4 text-muted-foreground" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={() => load(Math.max(1, page - 1))} disabled={page === 1}>Anterior</Button>
        <span className="text-sm self-center">Pág. {page} / {Math.max(1, Math.ceil(total / 50))}</span>
        <Button variant="outline" size="sm" onClick={() => load(page + 1)} disabled={page * 50 >= total}>Siguiente</Button>
      </div>

      {/* Document detail dialog */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Detalle Documento — {detail?.no_doc}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><span className="text-muted-foreground">Tipo:</span> {detail.tipo_doc}</div>
                <div><span className="text-muted-foreground">Fecha:</span> {detail.fecha}</div>
                <div><span className="text-muted-foreground">Estado:</span> <Badge variant={detail.estado === 'R' ? 'destructive' : 'default'}>{detail.estado === 'R' ? 'Reversado' : 'Activo'}</Badge></div>
                <div className="col-span-2"><span className="text-muted-foreground">Cliente:</span> {detail.no_cliente} — {detail.nombre_cliente}</div>
                <div><span className="text-muted-foreground">RNC:</span> {detail.rnc}</div>
                <div><span className="text-muted-foreground">Valor:</span> {fmt(detail.valor)}</div>
                <div><span className="text-muted-foreground">Saldo:</span> {fmt(detail.saldo)}</div>
                <div><span className="text-muted-foreground">NCF:</span> <span className="font-mono">{detail.ncf}</span></div>
                <div className="col-span-3"><span className="text-muted-foreground">Detalle:</span> {detail.detalle}</div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cuenta</TableHead>
                      <TableHead>Centro Costo</TableHead>
                      <TableHead className="text-right">Débito</TableHead>
                      <TableHead className="text-right">Crédito</TableHead>
                      <TableHead>Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detail.lineas || []).map((l: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono">{l.cuenta}</TableCell>
                        <TableCell>{l.centro_costo}</TableCell>
                        <TableCell className="text-right">{l.debito > 0 ? fmt(l.debito) : ''}</TableCell>
                        <TableCell className="text-right">{l.credito > 0 ? fmt(l.credito) : ''}</TableCell>
                        <TableCell>{l.detalle}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── FCXC208 Reversar Documento ───────────────────────────────────────────────
export function CxcReversar({ noCia, punto = '01', mes = 1, ano = 2025 }: P) {
  const [tdocus, setTdocus] = useState<any[]>([])
  const [noDoc, setNoDoc] = useState('')
  const [docInfo, setDocInfo] = useState<any>(null)
  const [tipoDocRev, setTipoDocRev] = useState('')
  const [fechaTrans, setFechaTrans] = useState(today)
  const [liberarNcf, setLiberarNcf] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { regalGeneralApi.cxcListTdocu(noCia).then(setTdocus) }, [noCia])

  const buscarDoc = async () => {
    setError(''); setDocInfo(null)
    if (!noDoc.trim()) return
    try {
      const d = await regalGeneralApi.cxcGetDocumento(noCia, noDoc)
      if (!d) { setError('Documento no encontrado'); return }
      setDocInfo(d)
    } catch { setError('Documento no encontrado') }
  }

  const reversar = async () => {
    setError(''); setSuccess('')
    if (!docInfo) { setError('Busque un documento primero'); return }
    if (!tipoDocRev) { setError('Seleccione tipo de documento para reverso'); return }
    setSaving(true)
    try {
      const r = await regalGeneralApi.cxcReversar({ no_cia: noCia, no_doc: noDoc, tipo_doc_rev: tipoDocRev, fecha_trans: fechaTrans, liberar_ncf: liberarNcf })
      setSuccess(`Reverso creado: documento ${r.no_doc_rev}`)
      setDocInfo(null); setNoDoc(''); setTipoDocRev('')
    } catch (e: any) { setError(e?.message || 'Error') } finally { setSaving(false) }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">FCXC208 — Reversar Documento</h1>

      <div className="grid grid-cols-2 gap-3 border rounded-lg p-4 bg-muted/30">
        <div className="space-y-1"><Label>No. Cia</Label><Input value={noCia} disabled /></div>
        <div className="space-y-1"><Label>Mes/Año en Proceso</Label><Input value={`${String(mes).padStart(2,'0')}/${ano}`} disabled /></div>
      </div>

      <div className="space-y-3 border rounded-lg p-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Documento a Reversar</h2>
        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <Label>No. Documento</Label>
            <Input value={noDoc} onChange={e => setNoDoc(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscarDoc()} className="font-mono" />
          </div>
          <div className="flex items-end">
            <Button onClick={buscarDoc} variant="secondary"><Search className="h-4 w-4 mr-1" />Buscar</Button>
          </div>
        </div>
        {docInfo && (
          <div className="grid grid-cols-3 gap-2 text-sm bg-blue-50 border border-blue-200 rounded p-3">
            <div><span className="text-muted-foreground">Tipo:</span> {docInfo.tipo_doc}</div>
            <div><span className="text-muted-foreground">Fecha:</span> {docInfo.fecha}</div>
            <div><span className="text-muted-foreground">Valor:</span> {fmt(docInfo.valor)}</div>
            <div className="col-span-2"><span className="text-muted-foreground">Cliente:</span> {docInfo.no_cliente} — {docInfo.nombre_cliente}</div>
            <div><span className="text-muted-foreground">NCF:</span> <span className="font-mono">{docInfo.ncf}</span></div>
          </div>
        )}
      </div>

      <div className="space-y-3 border rounded-lg p-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Parámetros de Reverso</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Reversar Con Tipo Doc.</Label>
            <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={tipoDocRev} onChange={e => setTipoDocRev(e.target.value)}>
              <option value="">-- Seleccione --</option>
              {tdocus.map(t => <option key={t.tipo_doc} value={t.tipo_doc}>{t.tipo_doc} — {t.descripcion}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Fecha Transacción</Label>
            <Input type="date" value={fechaTrans} onChange={e => setFechaTrans(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={liberarNcf} onChange={e => setLiberarNcf(e.target.checked)} className="h-4 w-4" />
          <Label>Liberar NCF</Label>
        </div>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
      {success && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded p-2">{success}</p>}

      <Button onClick={reversar} disabled={saving || !docInfo} className="gap-2 w-full">
        <RotateCcw className="h-4 w-4" />{saving ? 'Reversando...' : 'Reversar Documento'}
      </Button>
    </div>
  )
}

// ─── FCXC209 Pagos Masivos ────────────────────────────────────────────────────
export function CxcPagosMasivos({ noCia, punto = '01' }: P) {
  const [desde, setDesde] = useState(firstOfMonth)
  const [hasta, setHasta] = useState(today)
  const [fechaPago, setFechaPago] = useState(today)
  const [tipoDoc, setTipoDoc] = useState('')
  const [tdocus, setTdocus] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])
  const [pagos, setPagos] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { regalGeneralApi.cxcListTdocu(noCia).then(t => setTdocus(t.filter((x: any) => x.tipo_movimiento === 'CR'))) }, [noCia])

  const buscar = async () => {
    setError('')
    const rows = await regalGeneralApi.cxcGetDocsPendientesMasivo(noCia, desde, hasta)
    setDocs(rows)
    const p: Record<string, number> = {}
    rows.forEach((r: any) => { p[r.no_doc] = r.saldo })
    setPagos(p)
  }

  const totalAplicar = docs.reduce((s, d) => s + (pagos[d.no_doc] || 0), 0)

  const aplicar = async () => {
    setError(''); setSuccess('')
    if (!tipoDoc) { setError('Seleccione tipo de documento'); return }
    const pagosList = docs.filter(d => (pagos[d.no_doc] || 0) > 0).map(d => ({ no_doc: d.no_doc, valor_pagado: pagos[d.no_doc] }))
    if (!pagosList.length) { setError('No hay pagos a aplicar'); return }
    setSaving(true)
    try {
      await regalGeneralApi.cxcAplicarPagosMasivos({ no_cia: noCia, punto, tipo_doc: tipoDoc, fecha: fechaPago, pagos: pagosList })
      setSuccess(`${pagosList.length} pagos aplicados por ${fmt(totalAplicar)}`)
      setDocs([]); setPagos({})
    } catch (e: any) { setError(e?.message || 'Error') } finally { setSaving(false) }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">FCXC209 — Pagos Masivos</h1>

      <div className="flex flex-wrap gap-3 border rounded-lg p-3 bg-muted/30">
        <div className="space-y-1"><Label className="text-xs">Fecha Desde</Label><Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="h-8 w-36" /></div>
        <div className="space-y-1"><Label className="text-xs">Fecha Hasta</Label><Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="h-8 w-36" /></div>
        <div className="space-y-1"><Label className="text-xs">Fecha Pago</Label><Input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} className="h-8 w-36" /></div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo Doc. CR</Label>
          <select className="flex h-8 rounded-md border border-input bg-background px-3 text-sm"
            value={tipoDoc} onChange={e => setTipoDoc(e.target.value)}>
            <option value="">-- Seleccione --</option>
            {tdocus.map(t => <option key={t.tipo_doc} value={t.tipo_doc}>{t.tipo_doc} — {t.descripcion}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={buscar} size="sm" className="h-8 gap-1"><Search className="h-4 w-4" />Buscar</Button>
        </div>
      </div>

      {docs.length > 0 && (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Documento</TableHead>
                  <TableHead className="w-28">Fecha</TableHead>
                  <TableHead className="w-24">No. Cliente</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="w-32 text-right">Saldo Pend.</TableHead>
                  <TableHead className="w-36 text-right">Valor a Pagar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map(d => (
                  <TableRow key={d.no_doc}>
                    <TableCell className="font-mono text-sm">{d.no_doc}</TableCell>
                    <TableCell>{d.fecha}</TableCell>
                    <TableCell>{d.no_cliente}</TableCell>
                    <TableCell className="truncate max-w-[180px]">{d.nombre_cliente}</TableCell>
                    <TableCell className="text-right text-red-600">{fmt(d.saldo)}</TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" value={pagos[d.no_doc] || 0}
                        onChange={e => setPagos(p => ({ ...p, [d.no_doc]: Number(e.target.value) }))}
                        className="text-right h-7 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between bg-muted/50 rounded p-3">
            <span className="font-semibold">Total a Aplicar: {fmt(totalAplicar)}</span>
            <Button onClick={aplicar} disabled={saving} className="gap-2">
              <CreditCard className="h-4 w-4" />{saving ? 'Aplicando...' : 'Generar Pagos'}
            </Button>
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
      {success && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded p-2">{success}</p>}
    </div>
  )
}

// ─── FCXC210 Liberar Crédito ──────────────────────────────────────────────────
export function CxcLiberarCredito({ noCia, punto = '01' }: P) {
  const [noCliente, setNoCliente] = useState('')
  const [noDocCr, setNoDocCr] = useState('')
  const [docCr, setDocCr] = useState<any>(null)
  const [debitos, setDebitos] = useState<any[]>([])
  const [aplicaciones, setAplicaciones] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const buscar = async () => {
    setError('')
    if (!noCliente || !noDocCr) { setError('Ingrese cliente y documento CR'); return }
    try {
      const [doc, debs] = await Promise.all([
        regalGeneralApi.cxcGetDocumento(noCia, noDocCr),
        regalGeneralApi.cxcGetDebitosCliente(noCia, noCliente, noDocCr)
      ])
      setDocCr(doc)
      setDebitos(debs)
      const ap: Record<string, number> = {}
      debs.forEach((d: any) => { ap[d.no_doc] = 0 })
      setAplicaciones(ap)
    } catch { setError('Error al buscar') }
  }

  const totalAplicado = debitos.reduce((s, d) => s + (aplicaciones[d.no_doc] || 0), 0)
  const saldoCr = docCr ? Number(docCr.saldo || 0) : 0

  const liberar = async () => {
    setError(''); setSuccess('')
    if (totalAplicado > saldoCr) { setError(`Total aplicado (${fmt(totalAplicado)}) supera saldo CR (${fmt(saldoCr)})`); return }
    setSaving(true)
    try {
      const apList = debitos.filter(d => (aplicaciones[d.no_doc] || 0) > 0).map(d => ({ no_doc_dr: d.no_doc, valor_aplica: aplicaciones[d.no_doc] }))
      await regalGeneralApi.cxcLiberarCredito({ no_cia: noCia, no_doc_cr: noDocCr, aplicaciones: apList })
      setSuccess(`Crédito liberado. Total aplicado: ${fmt(totalAplicado)}`)
      setDocCr(null); setDebitos([]); setAplicaciones({})
    } catch (e: any) { setError(e?.message || 'Error') } finally { setSaving(false) }
  }

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <h1 className="text-2xl font-semibold">FCXC210 — Liberar Crédito</h1>

      <div className="grid grid-cols-3 gap-3 border rounded-lg p-4 bg-muted/30">
        <div className="space-y-1"><Label>No. Cliente</Label><Input value={noCliente} onChange={e => setNoCliente(e.target.value)} className="font-mono" /></div>
        <div className="space-y-1"><Label>Doc. CR (Nota Crédito)</Label><Input value={noDocCr} onChange={e => setNoDocCr(e.target.value)} className="font-mono" /></div>
        <div className="flex items-end"><Button onClick={buscar} className="gap-1"><Search className="h-4 w-4" />Buscar</Button></div>
      </div>

      {docCr && (
        <div className="grid grid-cols-3 gap-2 text-sm bg-blue-50 border border-blue-200 rounded p-3">
          <div><span className="text-muted-foreground">Doc CR:</span> {docCr.no_doc}</div>
          <div><span className="text-muted-foreground">Val. Original:</span> {fmt(docCr.valor)}</div>
          <div><span className="text-muted-foreground">Saldo Disponible:</span> <span className="font-semibold text-green-700">{fmt(docCr.saldo)}</span></div>
          <div className="col-span-2"><span className="text-muted-foreground">Cliente:</span> {docCr.no_cliente} — {docCr.nombre_cliente}</div>
          <div><span className="text-muted-foreground">Fecha:</span> {docCr.fecha}</div>
        </div>
      )}

      {debitos.length > 0 && (
        <>
          <h2 className="font-semibold">Débitos Afectados</h2>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Documento</TableHead>
                  <TableHead className="w-28">Fecha</TableHead>
                  <TableHead className="w-24">Tipo</TableHead>
                  <TableHead className="w-32 text-right">Saldo</TableHead>
                  <TableHead className="w-36 text-right">Valor a Aplicar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debitos.map(d => (
                  <TableRow key={d.no_doc}>
                    <TableCell className="font-mono text-sm">{d.no_doc}</TableCell>
                    <TableCell>{d.fecha}</TableCell>
                    <TableCell>{d.tipo_doc}</TableCell>
                    <TableCell className="text-right text-red-600">{fmt(d.saldo)}</TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" value={aplicaciones[d.no_doc] || 0}
                        onChange={e => setAplicaciones(a => ({ ...a, [d.no_doc]: Math.min(Number(e.target.value), d.saldo) }))}
                        className="text-right h-7" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between bg-muted/50 rounded p-3">
            <span>Total Aplicado: <span className={`font-semibold ${totalAplicado > saldoCr ? 'text-red-600' : 'text-green-700'}`}>{fmt(totalAplicado)}</span></span>
            <Button onClick={liberar} disabled={saving || totalAplicado <= 0}>
              {saving ? 'Liberando...' : 'Liberar Crédito'}
            </Button>
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
      {success && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded p-2">{success}</p>}
    </div>
  )
}

// ─── FCXC211 Corregir / Liberar NCF ──────────────────────────────────────────
export function CxcCorregirNcf({ noCia }: P) {
  const [noDoc, setNoDoc] = useState('')
  const [docInfo, setDocInfo] = useState<any>(null)
  const [ncf, setNcf] = useState('')
  const [ncfAnterior, setNcfAnterior] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const buscar = async () => {
    setError(''); setDocInfo(null)
    try {
      const d = await regalGeneralApi.cxcGetDocumento(noCia, noDoc)
      if (!d) { setError('Documento no encontrado'); return }
      setDocInfo(d); setNcf(d.ncf || ''); setNcfAnterior(d.ncf_anterior || '')
    } catch { setError('Documento no encontrado') }
  }

  const grabar = async () => {
    setError(''); setSuccess('')
    setSaving(true)
    try {
      await regalGeneralApi.cxcCorregirNcf({ no_cia: noCia, no_doc: noDoc, ncf, ncf_anterior: ncfAnterior })
      setSuccess('NCF actualizado correctamente')
    } catch (e: any) { setError(e?.message || 'Error') } finally { setSaving(false) }
  }

  return (
    <div className="p-6 space-y-4 max-w-xl">
      <h1 className="text-2xl font-semibold">FCXC211 — Corregir / Liberar NCF</h1>

      <div className="flex gap-2">
        <Input value={noDoc} onChange={e => setNoDoc(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscar()} placeholder="No. Documento..." className="font-mono" />
        <Button onClick={buscar} variant="secondary"><Search className="h-4 w-4 mr-1" />Buscar</Button>
      </div>

      {docInfo && (
        <div className="border rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Tipo Doc:</span> {docInfo.tipo_doc}</div>
            <div><span className="text-muted-foreground">Valor:</span> {fmt(docInfo.valor)}</div>
            <div className="col-span-2"><span className="text-muted-foreground">Cliente:</span> {docInfo.no_cliente} — {docInfo.nombre_cliente}</div>
            <div><span className="text-muted-foreground">Fecha:</span> {docInfo.fecha}</div>
            <div><span className="text-muted-foreground">Detalle:</span> {docInfo.detalle}</div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <div className="space-y-1">
              <Label>NCF (nuevo)</Label>
              <Input value={ncf} onChange={e => setNcf(e.target.value)} maxLength={19} className="font-mono" />
            </div>
            <div className="space-y-1">
              <Label>NCF Anterior</Label>
              <Input value={ncfAnterior} onChange={e => setNcfAnterior(e.target.value)} maxLength={19} className="font-mono" />
            </div>
          </div>
          <Button onClick={grabar} disabled={saving} className="w-full">
            {saving ? 'Guardando...' : 'Grabar Corrección'}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
      {success && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded p-2">{success}</p>}
    </div>
  )
}

// ─── FCXC116 Asignación Cliente a Ruta ────────────────────────────────────────
export function CxcClienteRuta({ noCia }: P) {
  const [rutas, setRutas] = useState<any[]>([])
  const [ruta, setRuta] = useState('')
  const [clientes, setClientes] = useState<any[]>([])
  const [clienteQ, setClienteQ] = useState('')
  const [clienteOpts, setClienteOpts] = useState<any[]>([])
  const [success, setSuccess] = useState('')

  useEffect(() => { regalGeneralApi.cxcListRutas(noCia).then(setRutas) }, [noCia])

  const loadClientes = async (r: string) => {
    setRuta(r)
    if (!r) { setClientes([]); return }
    const res = await regalGeneralApi.cxcGetClientesRuta(noCia, r)
    setClientes(res)
  }

  const searchCliente = async () => {
    if (!clienteQ.trim()) return
    const res = await regalGeneralApi.cxcListClientes(noCia, clienteQ, 1)
    setClienteOpts(res.items || [])
  }

  const asignar = async (c: any) => {
    await regalGeneralApi.cxcAsignarClienteRuta({ no_cia: noCia, no_cliente: c.no_cliente, ruta })
    setClienteOpts([]); setClienteQ('')
    setSuccess(`${c.nombre_cliente} asignado a ruta ${ruta}`)
    loadClientes(ruta)
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">FCXC116 — Asignación de Cliente a Ruta</h1>
      <div className="flex gap-3 items-end">
        <div className="space-y-1">
          <Label>Ruta</Label>
          <select className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm w-56"
            value={ruta} onChange={e => loadClientes(e.target.value)}>
            <option value="">-- Seleccione ruta --</option>
            {rutas.map(r => <option key={r.ruta} value={r.ruta}>{r.ruta} — {r.descripcion}</option>)}
          </select>
        </div>
        {ruta && (
          <div className="flex gap-2">
            <Input value={clienteQ} onChange={e => setClienteQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchCliente()} placeholder="Buscar cliente para asignar..." className="w-64" />
            <Button onClick={searchCliente} variant="secondary" size="sm"><Search className="h-4 w-4 mr-1" />Buscar</Button>
          </div>
        )}
      </div>

      {clienteOpts.length > 0 && (
        <div className="border rounded shadow-md bg-background max-h-48 overflow-y-auto">
          {clienteOpts.map(c => (
            <button key={c.no_cliente} onClick={() => asignar(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-0">
              {c.no_cliente} — {c.nombre_cliente}
            </button>
          ))}
        </div>
      )}

      {success && <p className="text-sm text-green-600">{success}</p>}

      {clientes.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">No. Cliente</TableHead>
                <TableHead>Nombre</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map(c => (
                <TableRow key={c.no_cliente}>
                  <TableCell className="font-mono">{c.no_cliente}</TableCell>
                  <TableCell>{c.nombre_cliente}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
