import { useEffect, useState } from 'react'
import { FileSpreadsheet, Printer, ShieldCheck } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props { noCia: string; punto: string; ano: number; mes: number }

// Fields returned by fat_repo.rep_ncf_607
type Ncf607 = {
  ncf: number; codigo_ncf: string; tipo_ncf_fiscal: string
  no_factura: string; tipo_factura: string; fecha: string
  rnc: string; nombre_cliente: string
  total_neto: number; impuesto: number; total_linea: number
}

const fmtDate = (d: any) => d ? String(d).slice(0, 10) : '—'

export function RepNcf607({ noCia, punto, ano, mes }: Props) {
  const [rows, setRows] = useState<Ncf607[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    if (!noCia) return
    setLoading(true)
    regalGeneralApi.fatRep607(noCia, punto, ano, mes)
      .then((d) => setRows((d.items ?? []) as Ncf607[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [noCia, punto, ano, mes])

  const totalNeto = rows.reduce((s, r) => s + (r.total_neto ?? 0), 0)
  const totalItbis = rows.reduce((s, r) => s + (r.impuesto ?? 0), 0)

  const mesAno = `${String(mes).padStart(2, '0')}-${ano}`

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, mesAno)
    downloadCsv(
      `fat-ncf-607-${ano}${String(mes).padStart(2, '0')}.csv`,
      ['NCF', 'Codigo NCF', 'Tipo NCF', 'No. Factura', 'Tipo Fact.', 'Fecha',
       'RNC', 'Cliente', 'Total Neto', 'ITBIS', 'Total Linea'],
      rows.map((r) => [r.ncf, r.codigo_ncf, r.tipo_ncf_fiscal, r.no_factura,
                       r.tipo_factura, fmtDate(r.fecha), r.rnc, r.nombre_cliente,
                       Number(r.total_neto ?? 0).toFixed(2), Number(r.impuesto ?? 0).toFixed(2),
                       Number(r.total_linea ?? 0).toFixed(2)]),
      meta,
    )
  }

  const exportPdf = async () => {
    const meta = await buildReportMeta(noCia, punto, mesAno)
    const now = new Date()
    const fecha = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`
    const win = window.open('', '_blank')!
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>
    <title>NCF 607 - ${ano}${String(mes).padStart(2,'0')}</title>
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
    @page{size:letter landscape;margin:1.4cm 1.5cm 1.6cm 1.5cm}
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
        <div class="mod-name">Facturación</div>
        <div class="rep-code">RFAT607</div>
        <div class="pag-line">NCF Formato 607</div>
        <div class="pag-line">${mesAno}</div>
      </div>
    </div>
    <hr class="sep-double"/>
    <table class="rpt"><thead><tr>
    <th>NCF</th><th>Cod. NCF</th><th>Tipo NCF</th><th>Factura</th><th>Tipo</th>
    <th>Fecha</th><th>RNC</th><th>Cliente</th>
    <th class="r">Total Neto</th><th class="r">ITBIS</th></tr></thead>
    <tbody>${rows.map((r) => `<tr>
    <td>${r.ncf}</td><td>${r.codigo_ncf}</td><td>${r.tipo_ncf_fiscal}</td>
    <td>${r.no_factura}</td><td>${r.tipo_factura}</td>
    <td>${fmtDate(r.fecha)}</td>
    <td>${r.rnc}</td><td>${r.nombre_cliente}</td>
    <td class="r">${Number(r.total_neto ?? 0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
    <td class="r">${Number(r.impuesto ?? 0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>`).join('')}
    </tbody>
    <tfoot><tr><td colspan="8"><b>TOTALES — ${rows.length} comprobante(s)</b></td>
    <td class="r"><b>${totalNeto.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</b></td>
    <td class="r"><b>${totalItbis.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</b></td></tr></tfoot>
    </table></body></html>`)
    win.document.close(); win.print()
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <ShieldCheck className='h-5 w-5' /> NCF Formato 607
          </h2>
          <p className='text-sm text-muted-foreground'>RFAT — Comprobantes Fiscales Emitidos · Empresa {noCia} · Punto {punto}</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={exportPdf}><Printer className='mr-1 h-4 w-4' /> PDF</Button>
          <Button variant='outline' size='sm' onClick={exportCsv}><FileSpreadsheet className='mr-1 h-4 w-4' /> Excel</Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-20'>NCF</TableHead>
            <TableHead className='w-20 text-center'>Cod. NCF</TableHead>
            <TableHead className='w-20 text-center'>Tipo NCF</TableHead>
            <TableHead className='w-24'>No. Factura</TableHead>
            <TableHead className='w-22'>Fecha</TableHead>
            <TableHead className='w-24'>RNC</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className='w-24 text-right'>Total Neto</TableHead>
            <TableHead className='w-24 text-right'>ITBIS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={9} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={9} className='py-10 text-center text-muted-foreground'>Sin comprobantes en este periodo.</TableCell></TableRow>}
          {rows.map((row, i) => (
            <TableRow key={`${row.ncf}-${i}`}>
              <TableCell className='font-mono text-xs'>{row.ncf}</TableCell>
              <TableCell className='text-center font-mono text-xs'>{row.codigo_ncf}</TableCell>
              <TableCell className='text-center font-mono text-xs'>{row.tipo_ncf_fiscal}</TableCell>
              <TableCell className='font-mono text-xs'>{row.no_factura}</TableCell>
              <TableCell className='text-xs'>{fmtDate(row.fecha)}</TableCell>
              <TableCell className='font-mono text-xs'>{row.rnc}</TableCell>
              <TableCell className='text-xs'>{row.nombre_cliente}</TableCell>
              <TableCell className='text-right font-mono text-xs font-semibold'>{Number(row.total_neto ?? 0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</TableCell>
              <TableCell className='text-right font-mono text-xs'>{Number(row.impuesto ?? 0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</TableCell>
            </TableRow>
          ))}
          {rows.length > 0 && (
            <TableRow className='border-t-2 font-semibold bg-muted/40'>
              <TableCell colSpan={7} className='text-right'>TOTALES ({rows.length} registros)</TableCell>
              <TableCell className='text-right font-mono'>{totalNeto.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</TableCell>
              <TableCell className='text-right font-mono'>{totalItbis.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  )
}
