import { useEffect, useState } from 'react'
import { BarChart3, FileSpreadsheet, Printer } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props { noCia: string; punto: string; ano: number; mes: number }

// Fields returned by fat_repo.rep_ventas_producto
type VentaProducto = {
  no_produ: string; descripcion: string; cantidad: number
  monto_neto: number; impuesto: number; descuento: number
}

const fmtNum = (n: number) => Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function RepVentasProducto({ noCia, punto, ano, mes }: Props) {
  const [rows, setRows] = useState<VentaProducto[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    if (!noCia) return
    setLoading(true)
    regalGeneralApi.fatRepVentas(noCia, punto, ano, mes)
      .then((d) => setRows((d.items ?? []) as VentaProducto[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [noCia, punto, ano, mes])

  const totalNeto = rows.reduce((s, r) => s + (r.monto_neto ?? 0), 0)
  const totalItbis = rows.reduce((s, r) => s + (r.impuesto ?? 0), 0)
  const totalBruto = rows.reduce((s, r) => s + (r.monto_neto ?? 0) + (r.impuesto ?? 0), 0)

  const mesAno = `${String(mes).padStart(2, '0')}-${ano}`

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, mesAno)
    downloadCsv(
      `fat-ventas-producto-${ano}${String(mes).padStart(2, '0')}.csv`,
      ['No. Producto', 'Descripcion', 'Cantidad', 'Monto Neto', 'ITBIS', 'Descuento'],
      rows.map((r) => [r.no_produ, r.descripcion, Number(r.cantidad ?? 0).toFixed(2),
                       Number(r.monto_neto ?? 0).toFixed(2), Number(r.impuesto ?? 0).toFixed(2),
                       Number(r.descuento ?? 0).toFixed(2)]),
      meta,
    )
  }

  const exportPdf = async () => {
    const meta = await buildReportMeta(noCia, punto, mesAno)
    const now = new Date()
    const fecha = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`
    const win = window.open('', '_blank')!
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>
    <title>RFAT301 - Ventas por Producto</title>
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
        <div class="rep-code">RFAT301</div>
        <div>Ventas por Producto</div>
        <div>${mesAno}</div>
      </div>
    </div>
    <hr class="sep-double"/>
    <table class="rpt"><thead><tr>
    <th>No. Producto</th><th>Descripcion</th><th class="r">Cantidad</th>
    <th class="r">Monto Neto</th><th class="r">ITBIS</th><th class="r">Descuento</th>
    <th class="r">Total Bruto</th></tr></thead>
    <tbody>${rows.map((r) => `<tr>
    <td>${r.no_produ}</td><td>${r.descripcion}</td>
    <td class="r">${fmtNum(r.cantidad)}</td>
    <td class="r">${fmtNum(r.monto_neto)}</td>
    <td class="r">${fmtNum(r.impuesto)}</td>
    <td class="r">${fmtNum(r.descuento)}</td>
    <td class="r">${fmtNum((r.monto_neto ?? 0) + (r.impuesto ?? 0))}</td></tr>`).join('')}
    </tbody>
    <tfoot><tr><td colspan="3"><b>TOTALES — ${rows.length} producto(s)</b></td>
    <td class="r"><b>${fmtNum(totalNeto)}</b></td>
    <td class="r"><b>${fmtNum(totalItbis)}</b></td>
    <td class="r"></td>
    <td class="r"><b>${fmtNum(totalBruto)}</b></td></tr></tfoot>
    </table></body></html>`)
    win.document.close(); win.print()
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <BarChart3 className='h-5 w-5' /> Ventas por Producto
          </h2>
          <p className='text-sm text-muted-foreground'>RFAT301 — Empresa {noCia} · Punto {punto}</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={exportPdf}><Printer className='mr-1 h-4 w-4' /> PDF</Button>
          <Button variant='outline' size='sm' onClick={exportCsv}><FileSpreadsheet className='mr-1 h-4 w-4' /> Excel</Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-28'>No. Producto</TableHead>
            <TableHead>Descripcion</TableHead>
            <TableHead className='w-24 text-right'>Cantidad</TableHead>
            <TableHead className='w-28 text-right'>Monto Neto</TableHead>
            <TableHead className='w-24 text-right'>ITBIS</TableHead>
            <TableHead className='w-24 text-right'>Descuento</TableHead>
            <TableHead className='w-28 text-right'>Total Bruto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>Sin ventas para este periodo.</TableCell></TableRow>}
          {rows.map((row) => (
            <TableRow key={row.no_produ}>
              <TableCell className='font-mono'>{row.no_produ}</TableCell>
              <TableCell className='text-sm'>{row.descripcion}</TableCell>
              <TableCell className='text-right font-mono'>{fmtNum(row.cantidad)}</TableCell>
              <TableCell className='text-right font-mono'>{fmtNum(row.monto_neto)}</TableCell>
              <TableCell className='text-right font-mono'>{fmtNum(row.impuesto)}</TableCell>
              <TableCell className='text-right font-mono'>{fmtNum(row.descuento)}</TableCell>
              <TableCell className='text-right font-mono font-semibold'>{fmtNum((row.monto_neto ?? 0) + (row.impuesto ?? 0))}</TableCell>
            </TableRow>
          ))}
          {rows.length > 0 && (
            <TableRow className='border-t-2 font-semibold bg-muted/40'>
              <TableCell colSpan={3} className='text-right'>TOTALES</TableCell>
              <TableCell className='text-right font-mono'>{fmtNum(totalNeto)}</TableCell>
              <TableCell className='text-right font-mono'>{fmtNum(totalItbis)}</TableCell>
              <TableCell />
              <TableCell className='text-right font-mono'>{fmtNum(totalBruto)}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  )
}
