import { useState } from 'react'
import { Building2, FileSpreadsheet, Printer, RefreshCw } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props { noCia: string; punto: string; ano: number; mes: number }

type VentaCliente = {
  no_cliente: number
  nombre_cliente: string
  facturas: number
  total_neto: number
  total_itbis: number
  total_bruto: number
}

const fmtN = (n: number) => Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function defaultDesde(ano: number, mes: number) { return `${ano}-${String(mes).padStart(2, '0')}-01` }
function defaultHasta(ano: number, mes: number) {
  const d = new Date(ano, mes, 0)
  return `${ano}-${String(mes).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function RepVentasCliente({ noCia, punto, ano, mes }: Props) {
  const [desde, setDesde] = useState(() => defaultDesde(ano, mes))
  const [hasta, setHasta] = useState(() => defaultHasta(ano, mes))
  const [rows, setRows] = useState<VentaCliente[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = () => {
    if (!noCia || !desde || !hasta) return
    setLoading(true)
    regalGeneralApi.fatRepVentasCliente(noCia, punto, desde, hasta)
      .then((r) => { setRows(r.items as VentaCliente[]); setLoaded(true) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const totalNeto = rows.reduce((s, r) => s + r.total_neto, 0)
  const totalItbis = rows.reduce((s, r) => s + r.total_itbis, 0)
  const totalBruto = rows.reduce((s, r) => s + r.total_bruto, 0)
  const totalFacts = rows.reduce((s, r) => s + r.facturas, 0)

  const periodoLabel = `${desde} / ${hasta}`

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, periodoLabel)
    downloadCsv(
      `fat-ventas-cliente-${desde}-${hasta}.csv`,
      ['No. Cliente', 'Nombre', 'Facturas', 'Total Neto', 'ITBIS', 'Total Bruto'],
      rows.map(r => [r.no_cliente, r.nombre_cliente, r.facturas, fmtN(r.total_neto), fmtN(r.total_itbis), fmtN(r.total_bruto)]),
      meta,
    )
  }

  const exportPdf = async () => {
    const meta = await buildReportMeta(noCia, punto, periodoLabel)
    const now = new Date()
    const fecha = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`
    const win = window.open('', '_blank')!
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>
    <title>RFAT303 - Ventas por Cliente</title>
    <style>
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
    @page{size:letter portrait;margin:1.4cm 1.5cm 1.6cm 1.5cm}
    @media print{body{margin:0;-webkit-print-color-adjust:exact}table{page-break-inside:avoid}}
    </style></head><body>
    <div class="rh">
      <div class="rh-left">
        <div class="co">${meta.company}</div>
        ${meta.direccion1 ? `<div class="co-line">${meta.direccion1}</div>` : ''}
        ${meta.ciudad ? `<div class="co-line">${meta.ciudad}</div>` : ''}
        ${meta.telefono ? `<div class="co-line">Tel. ${meta.telefono}</div>` : ''}
        ${meta.rnc ? `<div class="co-line">RNC ${meta.rnc}</div>` : ''}
        <div class="co-line">${fecha}</div>
      </div>
      <div class="rh-right">
        <div>Facturación</div>
        <div class="rep-code">RFAT303</div>
        <div>Ventas por Cliente</div>
        <div>${periodoLabel}</div>
      </div>
    </div>
    <hr class="sep-double"/>
    <table class="rpt"><thead><tr>
    <th>No. Cliente</th><th>Nombre</th><th class="r">Facturas</th>
    <th class="r">Total Neto</th><th class="r">ITBIS</th><th class="r">Total Bruto</th><th class="r">%</th></tr></thead>
    <tbody>${rows.map(r => `<tr>
    <td>${r.no_cliente}</td><td>${r.nombre_cliente}</td>
    <td class="r">${r.facturas}</td>
    <td class="r">${fmtN(r.total_neto)}</td>
    <td class="r">${fmtN(r.total_itbis)}</td>
    <td class="r">${fmtN(r.total_bruto)}</td>
    <td class="r">${totalBruto > 0 ? ((r.total_bruto/totalBruto)*100).toFixed(1) : 0}%</td>
    </tr>`).join('')}
    </tbody>
    <tfoot><tr><td colspan="2"><b>TOTALES — ${rows.length} cliente(s)</b></td>
    <td class="r"><b>${totalFacts}</b></td>
    <td class="r"><b>${fmtN(totalNeto)}</b></td>
    <td class="r"><b>${fmtN(totalItbis)}</b></td>
    <td class="r"><b>${fmtN(totalBruto)}</b></td><td class="r">100.0%</td></tr></tfoot>
    </table></body></html>`)
    win.document.close(); win.print()
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <Building2 className='h-5 w-5' /> Ventas por Cliente
          </h2>
          <p className='text-sm text-muted-foreground'>RFAT303 — Empresa {noCia} · Punto {punto}</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={exportPdf} disabled={!loaded}><Printer className='mr-1 h-4 w-4' /> PDF</Button>
          <Button variant='outline' size='sm' onClick={exportCsv} disabled={!loaded}><FileSpreadsheet className='mr-1 h-4 w-4' /> Excel</Button>
        </div>
      </div>

      {/* Filtros de fecha */}
      <div className='flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3'>
        <div className='flex flex-col gap-1'>
          <label className='text-xs font-medium text-muted-foreground'>Desde</label>
          <Input type='date' value={desde} onChange={(e) => setDesde(e.target.value)} className='h-8 w-36' />
        </div>
        <div className='flex flex-col gap-1'>
          <label className='text-xs font-medium text-muted-foreground'>Hasta</label>
          <Input type='date' value={hasta} onChange={(e) => setHasta(e.target.value)} className='h-8 w-36' />
        </div>
        <Button size='sm' onClick={load} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Cargando...' : 'Generar'}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-20 text-right'>No.</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className='w-20 text-right'>Facts.</TableHead>
            <TableHead className='w-32 text-right'>Total Neto</TableHead>
            <TableHead className='w-28 text-right'>ITBIS</TableHead>
            <TableHead className='w-32 text-right'>Total Bruto</TableHead>
            <TableHead className='w-20 text-right'>%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
          {!loading && !loaded && <TableRow><TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>Seleccione el rango de fechas y presione Generar.</TableCell></TableRow>}
          {!loading && loaded && rows.length === 0 && <TableRow><TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>Sin ventas para este período.</TableCell></TableRow>}
          {rows.map((row, i) => (
            <TableRow key={row.no_cliente} className={i < 3 ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}>
              <TableCell className='text-right font-mono text-sm'>{row.no_cliente || '—'}</TableCell>
              <TableCell className='text-sm font-medium'>{row.nombre_cliente}</TableCell>
              <TableCell className='text-right text-sm'>{row.facturas}</TableCell>
              <TableCell className='text-right font-mono text-sm'>{fmtN(row.total_neto)}</TableCell>
              <TableCell className='text-right font-mono text-sm'>{fmtN(row.total_itbis)}</TableCell>
              <TableCell className='text-right font-mono text-sm font-semibold'>{fmtN(row.total_bruto)}</TableCell>
              <TableCell className='text-right text-sm text-muted-foreground'>
                {totalBruto > 0 ? ((row.total_bruto / totalBruto) * 100).toFixed(1) : '0.0'}%
              </TableCell>
            </TableRow>
          ))}
          {rows.length > 0 && (
            <TableRow className='border-t-2 font-semibold bg-muted/40'>
              <TableCell colSpan={2} className='text-right'>TOTALES ({rows.length} clientes)</TableCell>
              <TableCell className='text-right font-mono'>{totalFacts}</TableCell>
              <TableCell className='text-right font-mono'>{fmtN(totalNeto)}</TableCell>
              <TableCell className='text-right font-mono'>{fmtN(totalItbis)}</TableCell>
              <TableCell className='text-right font-mono'>{fmtN(totalBruto)}</TableCell>
              <TableCell className='text-right'>100.0%</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  )
}
