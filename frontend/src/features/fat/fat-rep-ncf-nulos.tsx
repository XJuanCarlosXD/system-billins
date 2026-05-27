import { useEffect, useState } from 'react'
import { FileSpreadsheet, Printer, XCircle } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props { noCia: string; punto: string; ano: number; mes: number }

type NcfNulo = {
  ncf: string; tipo_ncf: string; fecha_desde: string; fecha_hasta: string
  motivo_anulacion: string; fecha_anulacion: string; no_factura: string
}

const fmtDate = (d: any) => d ? String(d).slice(0, 10) : '—'

export function RepNcfNulos({ noCia, punto, ano, mes }: Props) {
  const [rows, setRows] = useState<NcfNulo[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    if (!noCia) return
    setLoading(true)
    regalGeneralApi.fatRepNcfNulos(noCia, punto, ano, mes)
      .then((d) => setRows(d.items as NcfNulo[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [noCia, punto, ano, mes])

  const mesAno = `${String(mes).padStart(2, '0')}-${ano}`

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, mesAno)
    downloadCsv(
      `fat-ncf-nulos-${ano}${String(mes).padStart(2, '0')}.csv`,
      ['NCF', 'Tipo NCF', 'Fecha Desde', 'Fecha Hasta', 'Motivo', 'Fecha Anulación', 'No. Factura'],
      rows.map((r) => [r.ncf, r.tipo_ncf, fmtDate(r.fecha_desde), fmtDate(r.fecha_hasta),
                       r.motivo_anulacion, fmtDate(r.fecha_anulacion), r.no_factura || '']),
      meta,
    )
  }

  const exportPdf = async () => {
    const meta = await buildReportMeta(noCia, punto, mesAno)
    const now = new Date()
    const fecha = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`
    const win = window.open('', '_blank')!
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>
    <title>NCF Nulos / Anulados</title>
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
    table.rpt tbody td{padding:2px 5px;vertical-align:top;border:1px solid #000;line-height:1.4}
    table.rpt tfoot td{border:1px solid #000;font-weight:bold;padding:3px 5px;font-size:8pt;background:#e8e8e8}
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
        <div>Facturación</div>
        <div class="rep-code">RFAT</div>
        <div>NCF Nulos / Anulados</div>
        <div>${mesAno}</div>
      </div>
    </div>
    <hr class="sep-double"/>
    <table class="rpt"><thead><tr>
    <th>NCF</th><th>Tipo</th><th>Fecha Desde</th><th>Fecha Hasta</th>
    <th>Motivo Anulación</th><th>Fecha Anulación</th><th>Factura</th></tr></thead>
    <tbody>${rows.map((r) => `<tr>
    <td>${r.ncf}</td><td>${r.tipo_ncf}</td>
    <td>${fmtDate(r.fecha_desde)}</td><td>${fmtDate(r.fecha_hasta)}</td>
    <td>${r.motivo_anulacion}</td><td>${fmtDate(r.fecha_anulacion)}</td>
    <td>${r.no_factura || ''}</td></tr>`).join('')}
    </tbody>
    <tfoot><tr><td colspan="7">Total &nbsp; ${rows.length} comprobante(s) anulado(s)</td></tr></tfoot>
    </table></body></html>`)
    win.document.close(); win.print()
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <XCircle className='h-5 w-5' /> NCF Nulos / Anulados
          </h2>
          <p className='text-sm text-muted-foreground'>RFAT — Comprobantes anulados · Empresa {noCia} · Punto {punto}</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={exportPdf}><Printer className='mr-1 h-4 w-4' /> PDF</Button>
          <Button variant='outline' size='sm' onClick={exportCsv}><FileSpreadsheet className='mr-1 h-4 w-4' /> Excel</Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-32'>NCF</TableHead>
            <TableHead className='w-20 text-center'>Tipo</TableHead>
            <TableHead className='w-24'>Fecha Desde</TableHead>
            <TableHead className='w-24'>Fecha Hasta</TableHead>
            <TableHead>Motivo Anulación</TableHead>
            <TableHead className='w-28'>Fecha Anulación</TableHead>
            <TableHead className='w-24'>Factura</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>Sin NCF nulos en este período.</TableCell></TableRow>}
          {rows.map((row, i) => (
            <TableRow key={`${row.ncf}-${i}`}>
              <TableCell className='font-mono text-xs'>{row.ncf}</TableCell>
              <TableCell className='text-center'>
                <Badge variant='outline' className='text-xs'>{row.tipo_ncf}</Badge>
              </TableCell>
              <TableCell className='text-sm'>{fmtDate(row.fecha_desde)}</TableCell>
              <TableCell className='text-sm'>{fmtDate(row.fecha_hasta)}</TableCell>
              <TableCell className='text-sm'>{row.motivo_anulacion}</TableCell>
              <TableCell className='text-sm text-destructive'>{fmtDate(row.fecha_anulacion)}</TableCell>
              <TableCell className='font-mono text-sm'>{row.no_factura || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {rows.length > 0 && (
        <p className='text-sm text-muted-foreground'>{rows.length} comprobante{rows.length !== 1 ? 's' : ''} anulado{rows.length !== 1 ? 's' : ''} en este período.</p>
      )}
    </section>
  )
}
