// CXC Reportes: envejecimiento, cobros por vendedor, comisiones, NCF emitidos
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Search, FileDown, Printer } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { buildReportMeta, downloadCsv } from '../cnt/export-utils'

interface P { noCia: string; punto?: string; mes?: number; ano?: number }

const fmt = (n: any) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d: any) => d ? String(d).slice(0, 10) : '—'
const today = new Date().toISOString().slice(0, 10)
const firstOfMonth = today.slice(0, 7) + '-01'

const PDF_CSS = `
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body{font-family:Arial,sans-serif;font-size:8pt;color:#000;background:#fff;-webkit-print-color-adjust:exact}
.rh{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px}
.rh-left .co{font-size:11pt;font-weight:bold;line-height:1.3}
.rh-left .co-line{font-size:8pt;line-height:1.5}
.rh-right{font-size:8pt;text-align:right;line-height:1.5;white-space:nowrap}
.rh-right .rep-code{font-size:10pt;font-weight:bold}
.sep-double{border:none;border-top:3px double #000;margin:4px 0 2px 0}
table.rpt{width:100%;border-collapse:collapse;font-size:8pt;margin-top:4px;border:1px solid #000}
table.rpt thead th{font-weight:bold;text-align:left;border:1px solid #000;padding:3px 5px;white-space:nowrap;background:#e8e8e8}
table.rpt thead th.r{text-align:right}
table.rpt tbody td{padding:2px 5px;vertical-align:top;border:1px solid #000;line-height:1.4}
table.rpt tbody td.r{text-align:right}
table.rpt tfoot td{border:1px solid #000;font-weight:bold;padding:3px 5px;font-size:8pt;background:#e8e8e8}
table.rpt tfoot td.r{text-align:right}
@page{size:letter landscape;margin:1.4cm 1.5cm 1.6cm 1.5cm}
@media print{body{margin:0;-webkit-print-color-adjust:exact}table{page-break-inside:avoid}}
`

function buildHtmlHeader(meta: { company: string; direccion1?: string; ciudad?: string; telefono?: string; rnc?: string }, code: string, title: string, sub: string): string {
  const now = new Date()
  const fecha = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`
  return `<div class="rh">
  <div class="rh-left">
    <div class="co">${meta.company}</div>
    ${meta.direccion1 ? `<div class="co-line">${meta.direccion1}</div>` : ''}
    ${meta.ciudad ? `<div class="co-line">${meta.ciudad}</div>` : ''}
    ${meta.telefono ? `<div class="co-line">Tel. ${meta.telefono}</div>` : ''}
    ${meta.rnc ? `<div class="co-line">RNC ${meta.rnc}</div>` : ''}
    <div class="co-line">${fecha}</div>
  </div>
  <div class="rh-right">
    <div>Cuentas por Cobrar</div>
    <div class="rep-code">${code}</div>
    <div>${title}</div>
    <div>${sub}</div>
  </div>
</div>
<hr class="sep-double"/>`
}

function printHtml(title: string, bodyHtml: string) {
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>
  <title>${title}</title><style>${PDF_CSS}</style></head>
  <body>${bodyHtml}</body></html>`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const ifr = document.createElement('iframe')
  ifr.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;opacity:0'
  document.body.appendChild(ifr)
  ifr.onload = () => {
    setTimeout(() => {
      ifr.contentWindow?.print()
      setTimeout(() => { document.body.removeChild(ifr); URL.revokeObjectURL(url) }, 4000)
    }, 400)
  }
  ifr.src = url
}

// ─── Rep. Envejecimiento de Cartera ──────────────────────────────────────────
export function CxcRepEnvejecimiento({ noCia, punto }: P) {
  const [vendedor, setVendedor] = useState('')
  const [fechaCorte, setFechaCorte] = useState(today)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [vendedores, setVendedores] = useState<any[]>([])

  useState(() => { regalGeneralApi.cxcListVendedores(noCia).then(setVendedores) })

  const load = async () => {
    setLoading(true)
    try { setData(await regalGeneralApi.cxcRepEnvejecimiento(noCia, punto, vendedor, fechaCorte)) }
    finally { setLoading(false) }
  }

  const items = data?.items || []
  const totalRow = (key: string) => items.reduce((s: number, r: any) => s + (r[key] || 0), 0)

  const mesAno = fmtDate(fechaCorte).slice(0, 7).replace('-', '-')

  const printPdf = () => {
    const qs = new URLSearchParams({ no_cia: noCia ?? '', punto: punto ?? '' })
    if (vendedor) qs.set('vendedor', vendedor)
    if (fechaCorte) qs.set('fecha_corte', fechaCorte)
    window.open(`/print/cxc-rep-envejecimiento/current?${qs.toString()}`, '_blank')
  }

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia ?? '', punto ?? '', mesAno)
    downloadCsv(
      `envejecimiento_${fmtDate(fechaCorte)}.csv`,
      ['Cliente', 'Nombre', 'Vendedor', 'Total', '0-30', '31-60', '61-90', '+90'],
      items.map((r: any) => [r.no_cliente, r.nombre_cliente, r.vendedor,
        fmt(r.total), fmt(r.c0), fmt(r.c30), fmt(r.c60), fmt(r.c90 + r.c120)]),
      meta,
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Envejecimiento de Cartera</h1>
        <div className="flex gap-2">
          <Button onClick={exportCsv} variant="outline" size="sm" disabled={!items.length}><FileDown className="h-4 w-4 mr-1" />CSV</Button>
          <Button onClick={printPdf} variant="outline" size="sm" disabled={!items.length}><Printer className="h-4 w-4 mr-1" />PDF</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 border rounded-lg p-3 bg-muted/30">
        <div className="space-y-1">
          <Label className="text-xs">Vendedor</Label>
          <select className="flex h-8 rounded-md border border-input bg-background px-3 text-sm"
            value={vendedor} onChange={e => setVendedor(e.target.value)}>
            <option value="">Todos</option>
            {vendedores.map(v => <option key={v.vendedor} value={v.vendedor}>{v.vendedor} — {v.nombre}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fecha Corte</Label>
          <Input type="date" value={fechaCorte} onChange={e => setFechaCorte(e.target.value)} className="h-8 w-36" />
        </div>
        <div className="flex items-end"><Button onClick={load} size="sm" className="h-8 gap-1"><Search className="h-4 w-4" />Generar</Button></div>
      </div>

      {data && (
        <div className="text-sm font-semibold text-right">
          Total Cartera: <span className="text-red-700">{fmt(data.total)}</span>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Cliente</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-right font-bold">Total</TableHead>
              <TableHead className="text-right bg-green-50">0–30</TableHead>
              <TableHead className="text-right bg-yellow-50">31–60</TableHead>
              <TableHead className="text-right bg-orange-50">61–90</TableHead>
              <TableHead className="text-right bg-red-50">+90</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={8} className="text-center py-8">Generando...</TableCell></TableRow>}
            {!loading && items.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Presione Generar</TableCell></TableRow>}
            {items.map((r: any) => (
              <TableRow key={r.no_cliente}>
                <TableCell className="font-mono text-sm">{r.no_cliente}</TableCell>
                <TableCell>{r.nombre_cliente}</TableCell>
                <TableCell>{r.nombre_vendedor || r.vendedor}</TableCell>
                <TableCell className="text-right font-semibold">{fmt(r.total)}</TableCell>
                <TableCell className="text-right text-green-700 bg-green-50/50">{r.c0 > 0 ? fmt(r.c0) : ''}</TableCell>
                <TableCell className="text-right text-yellow-700 bg-yellow-50/50">{r.c30 > 0 ? fmt(r.c30) : ''}</TableCell>
                <TableCell className="text-right text-orange-700 bg-orange-50/50">{r.c60 > 0 ? fmt(r.c60) : ''}</TableCell>
                <TableCell className="text-right text-red-700 bg-red-50/50">{(r.c90 + r.c120) > 0 ? fmt(r.c90 + r.c120) : ''}</TableCell>
              </TableRow>
            ))}
            {items.length > 0 && (
              <TableRow className="font-bold bg-muted/50 border-t-2">
                <TableCell colSpan={3}>TOTALES</TableCell>
                <TableCell className="text-right">{fmt(totalRow('total'))}</TableCell>
                <TableCell className="text-right text-green-700">{fmt(totalRow('c0'))}</TableCell>
                <TableCell className="text-right text-yellow-700">{fmt(totalRow('c30'))}</TableCell>
                <TableCell className="text-right text-orange-700">{fmt(totalRow('c60'))}</TableCell>
                <TableCell className="text-right text-red-700">{fmt(totalRow('c90') + totalRow('c120'))}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ─── Rep. Cobros por Vendedor ─────────────────────────────────────────────────
export function CxcRepCobrosVendedor({ noCia, punto, mes = 1, ano = 2025 }: P) {
  const desdeDef = `${ano}-${String(mes).padStart(2,'0')}-01`
  const lastDay = new Date(ano, mes, 0).getDate()
  const hastaDef = `${ano}-${String(mes).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`

  const [desde, setDesde] = useState(desdeDef)
  const [hasta, setHasta] = useState(hastaDef)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setData(await regalGeneralApi.cxcRepCobrosVendedor(noCia, desde, hasta, punto)) }
    finally { setLoading(false) }
  }

  const items = data?.items || []
  const mesAno = `${String(mes).padStart(2,'0')}-${ano}`

  const printPdf = () => {
    const qs = new URLSearchParams({
      no_cia: noCia ?? '', punto: punto ?? '', desde, hasta,
    })
    window.open(`/print/cxc-rep-cobros-vendedor/current?${qs.toString()}`, '_blank')
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Cobros por Vendedor</h1>
        <div className="flex gap-2">
          <Button onClick={printPdf} variant="outline" size="sm" disabled={!items.length}><Printer className="h-4 w-4 mr-1" />PDF</Button>
        </div>
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
              <TableHead className="w-24">Vendedor</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-24 text-center">Cobros</TableHead>
              <TableHead className="w-40 text-right">Total Cobrado</TableHead>
              <TableHead className="w-20 text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={5} className="text-center py-8">Generando...</TableCell></TableRow>}
            {!loading && items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Sin datos</TableCell></TableRow>}
            {items.map((r: any) => (
              <TableRow key={r.vendedor}>
                <TableCell className="font-mono">{r.vendedor}</TableCell>
                <TableCell>{r.nombre_vendedor}</TableCell>
                <TableCell className="text-center">{r.cobros}</TableCell>
                <TableCell className="text-right font-medium">{fmt(r.total_cobrado)}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {data?.total > 0 ? ((r.total_cobrado / data.total) * 100).toFixed(1) : '0.0'}%
                </TableCell>
              </TableRow>
            ))}
            {items.length > 0 && (
              <TableRow className="font-bold bg-muted/50 border-t-2">
                <TableCell colSpan={3}>TOTAL</TableCell>
                <TableCell className="text-right">{fmt(data?.total)}</TableCell>
                <TableCell className="text-right">100%</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ─── Rep. Comisiones ──────────────────────────────────────────────────────────
export function CxcRepComisiones({ noCia, punto, mes = 1, ano = 2025 }: P) {
  const desdeDef = `${ano}-${String(mes).padStart(2,'0')}-01`
  const lastDay = new Date(ano, mes, 0).getDate()
  const hastaDef = `${ano}-${String(mes).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`

  const [desde, setDesde] = useState(desdeDef)
  const [hasta, setHasta] = useState(hastaDef)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setData(await regalGeneralApi.cxcRepComisiones(noCia, desde, hasta, punto)) }
    finally { setLoading(false) }
  }

  const items = data?.items || []
  const mesAno = `${String(mes).padStart(2,'0')}-${ano}`

  const printPdf = async () => {
    const meta = await buildReportMeta(noCia ?? '', punto ?? '', mesAno)
    const header = buildHtmlHeader(meta, 'RCXC403', 'Comisiones por Vendedor', `${fmtDate(desde)} al ${fmtDate(hasta)}`)
    const body = `${header}
    <table class="rpt"><thead><tr>
    <th>Vendedor</th><th>Nombre</th><th class="r">%</th><th class="r">Facturas</th>
    <th class="r">Total Ventas</th><th class="r">Comisión</th>
    </tr></thead>
    <tbody>${items.map((r: any) => `<tr>
    <td>${r.vendedor}</td><td>${r.nombre_vendedor}</td>
    <td class="r">${r.porciento}%</td>
    <td class="r">${r.facturas}</td>
    <td class="r">${fmt(r.total_ventas)}</td>
    <td class="r">${fmt(r.comision)}</td>
    </tr>`).join('')}
    </tbody>
    <tfoot><tr><td colspan="5"><b>TOTAL COMISIÓN</b></td>
    <td class="r"><b>${fmt(data?.total_comision)}</b></td></tr></tfoot>
    </table>`
    printHtml('RCXC403 — Comisiones por Vendedor', body)
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Comisiones por Vendedor</h1>
        <Button onClick={printPdf} variant="outline" size="sm" disabled={!items.length}><Printer className="h-4 w-4 mr-1" />PDF</Button>
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
              <TableHead className="w-24">Vendedor</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-16 text-right">%</TableHead>
              <TableHead className="w-24 text-center">Facts.</TableHead>
              <TableHead className="w-36 text-right">Total Ventas</TableHead>
              <TableHead className="w-36 text-right">Comisión</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={6} className="text-center py-8">Generando...</TableCell></TableRow>}
            {!loading && items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sin datos</TableCell></TableRow>}
            {items.map((r: any) => (
              <TableRow key={r.vendedor}>
                <TableCell className="font-mono">{r.vendedor}</TableCell>
                <TableCell>{r.nombre_vendedor}</TableCell>
                <TableCell className="text-right">{r.porciento}%</TableCell>
                <TableCell className="text-center">{r.facturas}</TableCell>
                <TableCell className="text-right">{fmt(r.total_ventas)}</TableCell>
                <TableCell className="text-right font-semibold text-green-700">{fmt(r.comision)}</TableCell>
              </TableRow>
            ))}
            {items.length > 0 && (
              <TableRow className="font-bold bg-muted/50 border-t-2">
                <TableCell colSpan={5}>TOTAL COMISIÓN</TableCell>
                <TableCell className="text-right text-green-700">{fmt(data?.total_comision)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ─── Rep. NCF Emitidos ────────────────────────────────────────────────────────
export function CxcRepNcf({ noCia, punto }: P) {
  const [desde, setDesde] = useState(firstOfMonth)
  const [hasta, setHasta] = useState(today)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setData(await regalGeneralApi.cxcRepNcf(noCia, desde, hasta, punto)) }
    finally { setLoading(false) }
  }

  const items = data?.items || []

  const exportCsv = async () => {
    const now = new Date()
    const mesAno = `${String(now.getMonth()+1).padStart(2,'0')}-${now.getFullYear()}`
    const meta = await buildReportMeta(noCia ?? '', punto ?? '', mesAno)
    downloadCsv(
      `ncf_${fmtDate(desde)}_${fmtDate(hasta)}.csv`,
      ['No Doc', 'Tipo', 'Fecha', 'NCF', 'NCF Anterior', 'Cliente', 'Nombre', 'RNC', 'Valor', 'Estado'],
      items.map((r: any) => [r.no_doc, r.tipo_doc, fmtDate(r.fecha), r.ncf, r.ncf_anterior,
        r.no_cliente, r.nombre_cliente, r.rnc,
        Number(r.valor || 0).toFixed(2), r.estado]),
      meta,
    )
  }

  const printPdf = () => {
    const qs = new URLSearchParams({
      no_cia: noCia ?? '', punto: punto ?? '', desde, hasta,
    })
    window.open(`/print/cxc-rep-ncf/current?${qs.toString()}`, '_blank')
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">NCF Emitidos por Período</h1>
        <div className="flex gap-2">
          <Button onClick={exportCsv} variant="outline" size="sm" disabled={!items.length}><FileDown className="h-4 w-4 mr-1" />CSV</Button>
          <Button onClick={printPdf} variant="outline" size="sm" disabled={!items.length}><Printer className="h-4 w-4 mr-1" />PDF</Button>
        </div>
      </div>
      <div className="flex gap-3 border rounded-lg p-3 bg-muted/30">
        <div className="space-y-1"><Label className="text-xs">Desde</Label><Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="h-8 w-36" /></div>
        <div className="space-y-1"><Label className="text-xs">Hasta</Label><Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="h-8 w-36" /></div>
        <div className="flex items-end"><Button onClick={load} size="sm" className="h-8 gap-1"><Search className="h-4 w-4" />Generar</Button></div>
      </div>

      {data && <div className="text-sm text-muted-foreground">{data.count} NCF emitidos — Total: {fmt(data.total)}</div>}

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">No. Doc</TableHead>
              <TableHead className="w-20">Tipo</TableHead>
              <TableHead className="w-28">Fecha</TableHead>
              <TableHead className="w-32 font-mono">NCF</TableHead>
              <TableHead className="w-28 font-mono">NCF Anterior</TableHead>
              <TableHead className="w-24">Cliente</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-28">RNC</TableHead>
              <TableHead className="w-32 text-right">Valor</TableHead>
              <TableHead className="w-20">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={10} className="text-center py-8">Generando...</TableCell></TableRow>}
            {!loading && items.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Sin NCF emitidos</TableCell></TableRow>}
            {items.map((r: any, i: number) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-sm">{r.no_doc}</TableCell>
                <TableCell><Badge variant="outline">{r.tipo_doc}</Badge></TableCell>
                <TableCell>{fmtDate(r.fecha)}</TableCell>
                <TableCell className="font-mono text-xs">{r.ncf}</TableCell>
                <TableCell className="font-mono text-xs">{r.ncf_anterior}</TableCell>
                <TableCell className="font-mono">{r.no_cliente}</TableCell>
                <TableCell className="truncate max-w-[140px]">{r.nombre_cliente}</TableCell>
                <TableCell>{r.rnc}</TableCell>
                <TableCell className="text-right">{fmt(r.valor)}</TableCell>
                <TableCell>
                  <Badge variant={r.estado === 'A' ? 'default' : 'destructive'}>{r.estado}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
