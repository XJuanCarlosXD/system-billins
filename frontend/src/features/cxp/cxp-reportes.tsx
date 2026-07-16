// CxP Reportes: alfabetico, mayor auxiliar, 606, 607
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, Printer } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'

interface P { noCia: string; punto?: string; mes?: number; ano?: number }

const fmt = (n: any) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const openPrint = (codigo: string, params: Record<string, string>) => {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  ).toString()
  window.open(`/print/${codigo}/current?${qs}`, '_blank')
}
const today = new Date().toISOString().slice(0, 10)
const firstOfMonth = today.slice(0, 7) + '-01'
const curYear = new Date().getFullYear()
const curMonth = new Date().getMonth() + 1

// ─── Rep. Alfabético de Proveedores ──────────────────────────────────────────
export function CxpRepAlfabetico({ noCia, punto }: P) {
  const [search, setSearch] = useState('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setData(await regalGeneralApi.cxpRepAlfabetico(noCia, punto, search)) }
    finally { setLoading(false) }
  }

  const items: any[] = data?.items || []

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">RCXP301 — Listado Alfabético de Proveedores</h1>
      </div>
      <div className="flex flex-wrap gap-3 border rounded-lg p-3 bg-muted/30">
        <div className="space-y-1">
          <Label className="text-xs">Buscar</Label>
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="nombre..." className="h-8 w-56" />
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={load} size="sm" className="h-8 gap-1">
            <Search className="h-4 w-4" />Generar
          </Button>
          <Button onClick={() => openPrint('cxp-rep-alfabetico', { no_cia: noCia, punto: punto || '', search })}
            size="sm" variant="outline" className="h-8 gap-1" disabled={!data}>
            <Printer className="h-4 w-4" />Imprimir PDF
          </Button>
        </div>
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">No. Prov.</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-28">RNC</TableHead>
              <TableHead className="w-28">Teléfono</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-32 text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={6} className="text-center py-8">Generando...</TableCell></TableRow>}
            {!loading && items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sin datos — presione Generar</TableCell></TableRow>}
            {items.map((r: any) => (
              <TableRow key={r.no_proveedor}>
                <TableCell className="font-mono text-sm">{r.no_proveedor}</TableCell>
                <TableCell>{r.nombre}</TableCell>
                <TableCell className="font-mono text-sm">{r.rnc || '—'}</TableCell>
                <TableCell>{r.telefono || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.e_mail || '—'}</TableCell>
                <TableCell className="text-right font-medium">{fmt(r.saldo)}</TableCell>
              </TableRow>
            ))}
            {items.length > 0 && (
              <TableRow className="font-bold bg-muted/50 border-t-2">
                <TableCell colSpan={5}>TOTAL — {items.length} proveedor(es)</TableCell>
                <TableCell className="text-right">{fmt(items.reduce((s: number, r: any) => s + (r.saldo || 0), 0))}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ─── Mayor Auxiliar CxP ───────────────────────────────────────────────────────
export function CxpRepMayor({ noCia, punto = '', mes = curMonth, ano = curYear }: P) {
  const desdeDef = `${ano}-${String(mes).padStart(2, '0')}-01`
  const lastDay = new Date(ano, mes, 0).getDate()
  const hastaDef = `${ano}-${String(mes).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const [desde, setDesde] = useState(desdeDef)
  const [hasta, setHasta] = useState(hastaDef)
  const [noProveedor, setNoProveedor] = useState('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (!punto) return alert('Seleccione un punto de trabajo')
    setLoading(true)
    try { setData(await regalGeneralApi.cxpRepMayor(noCia, punto, desde, hasta, noProveedor)) }
    finally { setLoading(false) }
  }

  const items: any[] = data?.items || []

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">RCXP302 — Mayor Auxiliar CxP</h1>
      </div>
      <div className="flex gap-3 flex-wrap border rounded-lg p-3 bg-muted/30">
        <div className="space-y-1"><Label className="text-xs">Desde</Label><Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="h-8 w-36" /></div>
        <div className="space-y-1"><Label className="text-xs">Hasta</Label><Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="h-8 w-36" /></div>
        <div className="space-y-1"><Label className="text-xs">Proveedor (opcional)</Label><Input value={noProveedor} onChange={e => setNoProveedor(e.target.value)} placeholder="No. proveedor..." className="h-8 w-36" /></div>
        <div className="flex items-end gap-2">
          <Button onClick={load} size="sm" className="h-8 gap-1"><Search className="h-4 w-4" />Generar</Button>
          <Button onClick={() => openPrint('cxp-rep-mayor', { no_cia: noCia, punto, desde, hasta, no_proveedor: noProveedor })}
            size="sm" variant="outline" className="h-8 gap-1" disabled={!data}>
            <Printer className="h-4 w-4" />Imprimir PDF
          </Button>
        </div>
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Proveedor</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-20">Tipo</TableHead>
              <TableHead className="w-24">No. Docu</TableHead>
              <TableHead className="w-28">Fecha</TableHead>
              <TableHead className="w-16">Mov.</TableHead>
              <TableHead className="w-32 text-right">Crédito</TableHead>
              <TableHead className="w-32 text-right">Débito</TableHead>
              <TableHead className="w-32 text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={9} className="text-center py-8">Generando...</TableCell></TableRow>}
            {!loading && items.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sin datos — presione Generar</TableCell></TableRow>}
            {items.map((r: any, i: number) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-sm">{r.no_proveedor}</TableCell>
                <TableCell className="text-sm">{r.nombre_proveedor}</TableCell>
                <TableCell className="font-mono text-sm">{r.tipo_docu}</TableCell>
                <TableCell className="font-mono text-sm">{r.no_docu}</TableCell>
                <TableCell className="text-sm">{r.fecha}</TableCell>
                <TableCell className="text-xs">{r.tipo_movi?.slice(0, 3)}</TableCell>
                <TableCell className="text-right text-green-700">{r.credito > 0 ? fmt(r.credito) : ''}</TableCell>
                <TableCell className="text-right text-red-700">{r.debito > 0 ? fmt(r.debito) : ''}</TableCell>
                <TableCell className="text-right font-medium">{fmt(r.saldo)}</TableCell>
              </TableRow>
            ))}
            {items.length > 0 && (
              <TableRow className="font-bold bg-muted/50 border-t-2">
                <TableCell colSpan={6}>TOTALES — {items.length} mov.</TableCell>
                <TableCell className="text-right text-green-700">{fmt(data?.total_credito)}</TableCell>
                <TableCell className="text-right text-red-700">{fmt(data?.total_debito)}</TableCell>
                <TableCell className="text-right">{fmt((data?.total_credito || 0) - (data?.total_debito || 0))}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ─── Reporte 606 — ITBIS Compras ──────────────────────────────────────────────
export function CxpRep606({ noCia, punto = '', mes = curMonth, ano = curYear }: P) {
  const [selAnio, setSelAnio] = useState(String(ano))
  const [selMes, setSelMes] = useState(String(mes))
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setData(await regalGeneralApi.cxpRep606(noCia, parseInt(selAnio), parseInt(selMes), punto)) }
    finally { setLoading(false) }
  }

  const items: any[] = data?.items || []

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">RCXP606 — Reporte 606 (ITBIS Compras Locales)</h1>
      </div>
      <div className="flex flex-wrap gap-3 border rounded-lg p-3 bg-muted/30">
        <div className="space-y-1"><Label className="text-xs">Año</Label><Input value={selAnio} onChange={e => setSelAnio(e.target.value)} className="h-8 w-20" /></div>
        <div className="space-y-1"><Label className="text-xs">Mes</Label><Input value={selMes} onChange={e => setSelMes(e.target.value)} className="h-8 w-16" placeholder="1-12" /></div>
        <div className="flex items-end gap-2">
          <Button onClick={load} size="sm" className="h-8 gap-1"><Search className="h-4 w-4" />Generar</Button>
          <Button onClick={() => openPrint('cxp-rep-606', { no_cia: noCia, punto, anio: selAnio, mes: selMes })}
            size="sm" variant="outline" className="h-8 gap-1" disabled={!data}>
            <Printer className="h-4 w-4" />Imprimir PDF
          </Button>
        </div>
      </div>
      {data && (
        <div className="flex gap-6 text-sm text-muted-foreground border rounded-lg p-3 bg-muted/20">
          <span><b>{data.count}</b> registros</span>
          <span>Monto Total: <b className="text-foreground">{fmt(data.total_monto)}</b></span>
          <span>ITBIS Total: <b className="text-foreground">{fmt(data.total_itbis)}</b></span>
        </div>
      )}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">RNC Prov.</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-20">NCF</TableHead>
              <TableHead className="w-24">Tipo NCF</TableHead>
              <TableHead className="w-28">Fecha</TableHead>
              <TableHead className="w-32 text-right">Monto</TableHead>
              <TableHead className="w-28 text-right">ITBIS</TableHead>
              <TableHead className="w-28 text-right">ITBIS Ret.</TableHead>
              <TableHead className="w-28 text-right">ISR Ret.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={9} className="text-center py-8">Generando...</TableCell></TableRow>}
            {!loading && items.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sin datos — presione Generar</TableCell></TableRow>}
            {items.map((r: any, i: number) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-sm">{r.rnc_proveedor || '—'}</TableCell>
                <TableCell className="text-sm">{r.nombre_proveedor}</TableCell>
                <TableCell className="font-mono text-sm">{r.ncf}</TableCell>
                <TableCell className="text-sm">{r.tipo_ncf}</TableCell>
                <TableCell className="text-sm">{r.fecha}</TableCell>
                <TableCell className="text-right font-medium">{fmt(r.monto_facturado)}</TableCell>
                <TableCell className="text-right">{fmt(r.itbis_facturado)}</TableCell>
                <TableCell className="text-right text-orange-700">{r.itbis_retenido > 0 ? fmt(r.itbis_retenido) : '—'}</TableCell>
                <TableCell className="text-right text-red-700">{r.isr_retenido > 0 ? fmt(r.isr_retenido) : '—'}</TableCell>
              </TableRow>
            ))}
            {items.length > 0 && (
              <TableRow className="font-bold bg-muted/50 border-t-2">
                <TableCell colSpan={5}>TOTALES</TableCell>
                <TableCell className="text-right">{fmt(data?.total_monto)}</TableCell>
                <TableCell className="text-right">{fmt(data?.total_itbis)}</TableCell>
                <TableCell colSpan={2}></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ─── Reporte 607 — Retenciones ISR ───────────────────────────────────────────
export function CxpRep607({ noCia, punto = '', mes = curMonth, ano = curYear }: P) {
  const [selAnio, setSelAnio] = useState(String(ano))
  const [selMes, setSelMes] = useState(String(mes))
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setData(await regalGeneralApi.cxpRep607(noCia, parseInt(selAnio), parseInt(selMes), punto)) }
    finally { setLoading(false) }
  }

  const items: any[] = data?.items || []

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">RCXP607 — Reporte 607 (Retenciones ISR)</h1>
      </div>
      <div className="flex flex-wrap gap-3 border rounded-lg p-3 bg-muted/30">
        <div className="space-y-1"><Label className="text-xs">Año</Label><Input value={selAnio} onChange={e => setSelAnio(e.target.value)} className="h-8 w-20" /></div>
        <div className="space-y-1"><Label className="text-xs">Mes</Label><Input value={selMes} onChange={e => setSelMes(e.target.value)} className="h-8 w-16" placeholder="1-12" /></div>
        <div className="flex items-end gap-2">
          <Button onClick={load} size="sm" className="h-8 gap-1"><Search className="h-4 w-4" />Generar</Button>
          <Button onClick={() => openPrint('cxp-rep-607', { no_cia: noCia, punto, anio: selAnio, mes: selMes })}
            size="sm" variant="outline" className="h-8 gap-1" disabled={!data}>
            <Printer className="h-4 w-4" />Imprimir PDF
          </Button>
        </div>
      </div>
      {data && (
        <div className="flex gap-6 text-sm text-muted-foreground border rounded-lg p-3 bg-muted/20">
          <span><b>{data.count}</b> registros</span>
          <span>Total ISR Retenido: <b className="text-foreground">{fmt(data.total_isr)}</b></span>
          <span>Total ITBIS Retenido: <b className="text-foreground">{fmt(data.total_itbis)}</b></span>
        </div>
      )}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">RNC Prov.</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-20">NCF</TableHead>
              <TableHead className="w-28">Fecha</TableHead>
              <TableHead className="w-32 text-right">Monto Pago</TableHead>
              <TableHead className="w-28 text-right">ISR Ret.</TableHead>
              <TableHead className="w-28 text-right">ITBIS Ret.</TableHead>
              <TableHead className="w-20 text-center">Tipo Ret.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={8} className="text-center py-8">Generando...</TableCell></TableRow>}
            {!loading && items.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Sin datos — presione Generar</TableCell></TableRow>}
            {items.map((r: any, i: number) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-sm">{r.rnc_proveedor || '—'}</TableCell>
                <TableCell className="text-sm">{r.nombre_proveedor}</TableCell>
                <TableCell className="font-mono text-sm">{r.ncf}</TableCell>
                <TableCell className="text-sm">{r.fecha}</TableCell>
                <TableCell className="text-right font-medium">{fmt(r.monto_pago)}</TableCell>
                <TableCell className="text-right text-red-700">{fmt(r.isr_retenido)}</TableCell>
                <TableCell className="text-right text-orange-700">{r.itbis_retenido > 0 ? fmt(r.itbis_retenido) : '—'}</TableCell>
                <TableCell className="text-center text-sm">{r.tipo_retencion}</TableCell>
              </TableRow>
            ))}
            {items.length > 0 && (
              <TableRow className="font-bold bg-muted/50 border-t-2">
                <TableCell colSpan={4}>TOTALES</TableCell>
                <TableCell className="text-right">{fmt(items.reduce((s: number, r: any) => s + (r.monto_pago || 0), 0))}</TableCell>
                <TableCell className="text-right">{fmt(data?.total_isr)}</TableCell>
                <TableCell className="text-right">{fmt(data?.total_itbis)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
