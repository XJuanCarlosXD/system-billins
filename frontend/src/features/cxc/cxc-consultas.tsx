// CXC Consultas: estado cuenta, balance, histórico, libro ventas
import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, FileDown } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'

interface P { noCia: string; punto?: string; mes?: number; ano?: number }

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })
const today = new Date().toISOString().slice(0, 10)
const firstOfMonth = today.slice(0, 7) + '-01'

// ─── Estado de Cuenta ─────────────────────────────────────────────────────────
export function CxcEstadoCuenta({ noCia }: P) {
  const [noCliente, setNoCliente] = useState('')
  const [clienteQ, setClienteQ] = useState('')
  const [clienteOpts, setClienteOpts] = useState<any[]>([])
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const searchCliente = async () => {
    if (!clienteQ.trim()) return
    const res = await regalGeneralApi.cxcListClientes(noCia, clienteQ, 1)
    setClienteOpts(res.items || [])
  }

  const selectCliente = (c: any) => {
    setNoCliente(c.no_cliente)
    setClienteOpts([])
    setClienteQ(c.nombre_cliente)
  }

  const load = async () => {
    if (!noCliente) return
    setLoading(true)
    try {
      const res = await regalGeneralApi.cxcEstadoCuenta(noCia, noCliente)
      setData(res)
    } finally { setLoading(false) }
  }

  const aging = (diasVencido: number) => {
    if (diasVencido <= 30) return 'text-green-600'
    if (diasVencido <= 60) return 'text-yellow-600'
    if (diasVencido <= 90) return 'text-orange-600'
    return 'text-red-700 font-semibold'
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Estado de Cuenta</h1>
      <div className="flex gap-2 items-end">
        <div className="space-y-1 relative">
          <Label>Cliente</Label>
          <div className="flex gap-2">
            <Input value={clienteQ} onChange={e => { setClienteQ(e.target.value); if (!e.target.value) setNoCliente('') }}
              onKeyDown={e => e.key === 'Enter' && searchCliente()} placeholder="Nombre o código..." className="w-72" />
            <Button onClick={searchCliente} variant="secondary" size="sm"><Search className="h-4 w-4" /></Button>
          </div>
          {clienteOpts.length > 0 && (
            <div className="absolute top-full mt-1 border rounded shadow-md bg-background max-h-48 overflow-y-auto z-20 w-full">
              {clienteOpts.map(c => (
                <button key={c.no_cliente} onClick={() => selectCliente(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-0">
                  {c.no_cliente} — {c.nombre_cliente}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <Label>No. Cliente</Label>
          <Input value={noCliente} onChange={e => setNoCliente(e.target.value)} className="font-mono w-28" />
        </div>
        <Button onClick={load} className="gap-1"><Search className="h-4 w-4" />Consultar</Button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-3 gap-3 border rounded-lg p-4 bg-blue-50 border-blue-200">
            <div><span className="text-muted-foreground text-sm">Cliente:</span><div className="font-semibold">{data.cliente?.nombre}</div></div>
            <div><span className="text-muted-foreground text-sm">Límite Crédito:</span><div className="font-semibold">{fmt(data.cliente?.limite)}</div></div>
            <div><span className="text-muted-foreground text-sm">Días Crédito:</span><div className="font-semibold">{data.cliente?.dias} días</div></div>
            <div className="col-span-3 pt-2 border-t border-blue-200">
              <span className="text-muted-foreground text-sm">Total Pendiente:</span>
              <span className="text-xl font-bold text-red-700 ml-2">{fmt(data.total_pendiente)}</span>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Documento</TableHead>
                  <TableHead className="w-20">Tipo</TableHead>
                  <TableHead className="w-28">Fecha</TableHead>
                  <TableHead className="w-32 text-right">Valor</TableHead>
                  <TableHead className="w-32 text-right">Saldo</TableHead>
                  <TableHead className="w-24 text-center">Días</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="w-28">NCF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.documentos || []).map((d: any) => (
                  <TableRow key={d.no_doc}>
                    <TableCell className="font-mono text-sm">{d.no_doc}</TableCell>
                    <TableCell><Badge variant="outline">{d.tipo_doc}</Badge></TableCell>
                    <TableCell>{d.fecha}</TableCell>
                    <TableCell className="text-right">{fmt(d.valor)}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(d.saldo)}</TableCell>
                    <TableCell className={`text-center ${aging(d.dias_vencido)}`}>{d.dias_vencido}</TableCell>
                    <TableCell className="truncate max-w-[160px]">{d.detalle}</TableCell>
                    <TableCell className="font-mono text-xs">{d.ncf}</TableCell>
                  </TableRow>
                ))}
                {(data.documentos || []).length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Sin documentos pendientes</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Balance de Clientes (Envejecimiento) ────────────────────────────────────
export function CxcBalance({ noCia, punto }: P) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const r = await regalGeneralApi.cxcBalanceClientes(noCia, punto); setRows(r) }
    finally { setLoading(false) }
  }

  const total = (key: string) => rows.reduce((s, r) => s + (r[key] || 0), 0)

  const exportCsv = () => {
    const headers = ['Cliente','Nombre','Total','0-30','31-60','61-90','+90']
    const data = rows.map(r => [r.no_cliente, r.nombre_cliente, r.total_saldo, r.dias_0_30, r.dias_31_60, r.dias_61_90, r.mas_90])
    const csv = [headers, ...data].map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'balance_clientes.csv'
    a.click()
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Balance de Clientes — Envejecimiento de Cartera</h1>
        <div className="flex gap-2">
          <Button onClick={exportCsv} variant="outline" size="sm" disabled={!rows.length}><FileDown className="h-4 w-4 mr-1" />CSV</Button>
          <Button onClick={load} size="sm" className="gap-1"><Search className="h-4 w-4" />Actualizar</Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Cliente</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right bg-green-50">0–30 días</TableHead>
              <TableHead className="text-right bg-yellow-50">31–60 días</TableHead>
              <TableHead className="text-right bg-orange-50">61–90 días</TableHead>
              <TableHead className="text-right bg-red-50">+90 días</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={8} className="text-center py-8">Cargando...</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Presione Actualizar</TableCell></TableRow>}
            {rows.map(r => (
              <TableRow key={r.no_cliente}>
                <TableCell className="font-mono text-sm">{r.no_cliente}</TableCell>
                <TableCell className="font-medium">{r.nombre_cliente}</TableCell>
                <TableCell>{r.vendedor}</TableCell>
                <TableCell className="text-right font-semibold">{fmt(r.total_saldo)}</TableCell>
                <TableCell className="text-right text-green-700 bg-green-50/50">{fmt(r.dias_0_30)}</TableCell>
                <TableCell className="text-right text-yellow-700 bg-yellow-50/50">{fmt(r.dias_31_60)}</TableCell>
                <TableCell className="text-right text-orange-700 bg-orange-50/50">{fmt(r.dias_61_90)}</TableCell>
                <TableCell className="text-right text-red-700 bg-red-50/50">{fmt(r.mas_90)}</TableCell>
              </TableRow>
            ))}
            {rows.length > 0 && (
              <TableRow className="font-bold bg-muted/50 border-t-2">
                <TableCell colSpan={3}>TOTALES</TableCell>
                <TableCell className="text-right">{fmt(total('total_saldo'))}</TableCell>
                <TableCell className="text-right text-green-700">{fmt(total('dias_0_30'))}</TableCell>
                <TableCell className="text-right text-yellow-700">{fmt(total('dias_31_60'))}</TableCell>
                <TableCell className="text-right text-orange-700">{fmt(total('dias_61_90'))}</TableCell>
                <TableCell className="text-right text-red-700">{fmt(total('mas_90'))}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ─── Histórico de Pagos ───────────────────────────────────────────────────────
export function CxcHistorico({ noCia }: P) {
  const [noCliente, setNoCliente] = useState('')
  const [desde, setDesde] = useState(firstOfMonth)
  const [hasta, setHasta] = useState(today)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const r = await regalGeneralApi.cxcHistorico(noCia, noCliente, desde, hasta); setRows(r) }
    finally { setLoading(false) }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Histórico de Pagos</h1>
      <div className="flex flex-wrap gap-3 border rounded-lg p-3 bg-muted/30">
        <div className="space-y-1"><Label className="text-xs">No. Cliente</Label><Input value={noCliente} onChange={e => setNoCliente(e.target.value)} className="h-8 w-28 font-mono" /></div>
        <div className="space-y-1"><Label className="text-xs">Desde</Label><Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="h-8 w-36" /></div>
        <div className="space-y-1"><Label className="text-xs">Hasta</Label><Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="h-8 w-36" /></div>
        <div className="flex items-end"><Button onClick={load} size="sm" className="h-8 gap-1"><Search className="h-4 w-4" />Consultar</Button></div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Documento</TableHead>
              <TableHead className="w-20">Tipo</TableHead>
              <TableHead className="w-28">Fecha</TableHead>
              <TableHead className="w-24">Cliente</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-32 text-right">Valor</TableHead>
              <TableHead className="w-32 text-right">Saldo</TableHead>
              <TableHead className="w-20">Mov.</TableHead>
              <TableHead className="w-24">NCF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={9} className="text-center py-8">Cargando...</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sin registros</TableCell></TableRow>}
            {rows.map(r => (
              <TableRow key={r.no_doc}>
                <TableCell className="font-mono text-sm">{r.no_doc}</TableCell>
                <TableCell><Badge variant="outline">{r.tipo_doc}</Badge></TableCell>
                <TableCell>{r.fecha}</TableCell>
                <TableCell className="font-mono">{r.no_cliente}</TableCell>
                <TableCell className="truncate max-w-[160px]">{r.nombre_cliente}</TableCell>
                <TableCell className="text-right">{fmt(r.valor)}</TableCell>
                <TableCell className={`text-right ${Number(r.saldo) > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(r.saldo)}</TableCell>
                <TableCell><Badge variant={r.tipo_movimiento === 'DR' ? 'default' : 'secondary'}>{r.tipo_movimiento}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{r.ncf}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ─── Libro de Ventas ──────────────────────────────────────────────────────────
export function CxcLibroVentas({ noCia, punto }: P) {
  const [desde, setDesde] = useState(firstOfMonth)
  const [hasta, setHasta] = useState(today)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const r = await regalGeneralApi.cxcLibroVentas(noCia, desde, hasta, punto); setRows(r) }
    finally { setLoading(false) }
  }

  const total = rows.reduce((s, r) => s + Number(r.valor || 0), 0)

  const exportCsv = () => {
    const headers = ['No Doc','Tipo','Fecha','NCF','Cliente','RNC','Valor']
    const data = rows.map(r => [r.no_doc, r.tipo_doc, r.fecha, r.ncf, r.nombre_cliente, r.rnc, r.valor])
    const csv = [headers, ...data].map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `libro_ventas_${desde}_${hasta}.csv`
    a.click()
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Libro de Ventas</h1>
        <Button onClick={exportCsv} variant="outline" size="sm" disabled={!rows.length}><FileDown className="h-4 w-4 mr-1" />CSV</Button>
      </div>
      <div className="flex gap-3 border rounded-lg p-3 bg-muted/30">
        <div className="space-y-1"><Label className="text-xs">Desde</Label><Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="h-8 w-36" /></div>
        <div className="space-y-1"><Label className="text-xs">Hasta</Label><Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="h-8 w-36" /></div>
        <div className="flex items-end"><Button onClick={load} size="sm" className="h-8 gap-1"><Search className="h-4 w-4" />Generar</Button></div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">No. Doc</TableHead>
              <TableHead className="w-20">Tipo</TableHead>
              <TableHead className="w-28">Fecha</TableHead>
              <TableHead className="w-24 font-mono">NCF</TableHead>
              <TableHead className="w-24">Cliente</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-28">RNC</TableHead>
              <TableHead className="w-32 text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={8} className="text-center py-8">Cargando...</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Sin registros</TableCell></TableRow>}
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-sm">{r.no_doc}</TableCell>
                <TableCell><Badge variant="outline">{r.tipo_doc}</Badge></TableCell>
                <TableCell>{r.fecha}</TableCell>
                <TableCell className="font-mono text-xs">{r.ncf}</TableCell>
                <TableCell className="font-mono">{r.no_cliente}</TableCell>
                <TableCell className="truncate max-w-[160px]">{r.nombre_cliente}</TableCell>
                <TableCell>{r.rnc}</TableCell>
                <TableCell className="text-right">{fmt(r.valor)}</TableCell>
              </TableRow>
            ))}
            {rows.length > 0 && (
              <TableRow className="font-bold bg-muted/50">
                <TableCell colSpan={7}>TOTAL ({rows.length} documentos)</TableCell>
                <TableCell className="text-right">{fmt(total)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
