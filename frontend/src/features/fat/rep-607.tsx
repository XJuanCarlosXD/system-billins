import { useEffect, useState } from 'react'
import { FileSpreadsheet, Printer, ShieldCheck } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props { noCia: string; punto: string; ano: number; mes: number }

type Ncf607 = {
  rnc_cedula: string; tipo_id: string; tipo_bienes: string; ncf: string; ncf_modificado: string
  fecha: string; itbis_facturado: number; itbis_retenido_tercero: number; itbis_retenido_renta: number
  itbis_percibido: number; total_facturado: number; isr: number; tipo_pago: string
}

export function RepNcf607({ noCia, punto, ano, mes }: Props) {
  const [rows, setRows] = useState<Ncf607[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    if (!noCia) return
    setLoading(true)
    regalGeneralApi.fatRep607(noCia, punto, ano, mes)
      .then((d) => setRows(d.items as Ncf607[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [noCia, punto, ano, mes])

  const totalFacturado = rows.reduce((s, r) => s + r.total_facturado, 0)
  const totalItbis = rows.reduce((s, r) => s + r.itbis_facturado, 0)

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, `${String(mes).padStart(2, '0')}/${ano}`)
    downloadCsv(
    `fat-ncf-607-${ano}${String(mes).padStart(2, '0')}.csv`,
    ['RNC/Cédula', 'Tipo ID', 'Tipo Bienes', 'NCF', 'NCF Modificado', 'Fecha',
     'ITBIS Facturado', 'ITBIS Ret. Tercero', 'ITBIS Ret. Renta', 'ITBIS Percibido',
     'Total Facturado', 'ISR', 'Tipo Pago'],
    rows.map((r) => [r.rnc_cedula, r.tipo_id, r.tipo_bienes, r.ncf, r.ncf_modificado || '',
                     r.fecha, r.itbis_facturado.toFixed(2), r.itbis_retenido_tercero.toFixed(2),
                     r.itbis_retenido_renta.toFixed(2), r.itbis_percibido.toFixed(2),
                     r.total_facturado.toFixed(2), r.isr.toFixed(2), r.tipo_pago]),
      meta,
    )
  }

  const exportPdf = async () => {
    const meta = await buildReportMeta(noCia, punto, `${String(mes).padStart(2, '0')}/${ano}`)
    const win = window.open('', '_blank')!
    win.document.write(`<html><head><title>NCF 607 - ${ano}${String(mes).padStart(2,'0')}</title>
    <style>body{font-family:Arial,sans-serif;font-size:8px;padding:15px}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:2px 4px}
    th{background:#ddd;font-weight:bold;text-align:left}.hdr{margin-bottom:10px}
    h3{margin:0;font-size:13px}.sub{color:#666}.r{text-align:right}
    .total{font-weight:bold;background:#f0f0f0}</style></head><body>
    <div class="hdr"><h3>${meta.empresa}</h3>
    <div class="sub">Formato 607 — Comprobantes Fiscales Emitidos · ${meta.periodo}</div>
    <div class="sub">Generado: ${meta.fecha}</div></div>
    <table><thead><tr><th>RNC/Cédula</th><th>T.ID</th><th>T.Bienes</th><th>NCF</th><th>NCF Mod.</th>
    <th>Fecha</th><th class="r">ITBIS Fact.</th><th class="r">Total Fact.</th><th>T.Pago</th></tr></thead>
    <tbody>${rows.map((r) => `<tr>
    <td>${r.rnc_cedula}</td><td>${r.tipo_id}</td><td>${r.tipo_bienes}</td>
    <td>${r.ncf}</td><td>${r.ncf_modificado || ''}</td><td>${r.fecha}</td>
    <td class="r">${r.itbis_facturado.toFixed(2)}</td>
    <td class="r">${r.total_facturado.toFixed(2)}</td><td>${r.tipo_pago}</td></tr>`).join('')}
    <tr class="total"><td colspan="6"><b>TOTALES</b></td>
    <td class="r"><b>${totalItbis.toFixed(2)}</b></td>
    <td class="r"><b>${totalFacturado.toFixed(2)}</b></td><td></td></tr>
    </tbody></table></body></html>`)
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
            <TableHead className='w-28'>RNC/Cédula</TableHead>
            <TableHead className='w-14 text-center'>T.ID</TableHead>
            <TableHead className='w-20 text-center'>T.Bienes</TableHead>
            <TableHead className='w-28'>NCF</TableHead>
            <TableHead className='w-28'>NCF Mod.</TableHead>
            <TableHead className='w-22'>Fecha</TableHead>
            <TableHead className='w-24 text-right'>ITBIS Fact.</TableHead>
            <TableHead className='w-28 text-right'>Total Fact.</TableHead>
            <TableHead className='w-20 text-center'>T. Pago</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={9} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={9} className='py-10 text-center text-muted-foreground'>Sin comprobantes en este período.</TableCell></TableRow>}
          {rows.map((row, i) => (
            <TableRow key={`${row.ncf}-${i}`}>
              <TableCell className='font-mono text-xs'>{row.rnc_cedula}</TableCell>
              <TableCell className='text-center font-mono text-xs'>{row.tipo_id}</TableCell>
              <TableCell className='text-center font-mono text-xs'>{row.tipo_bienes}</TableCell>
              <TableCell className='font-mono text-xs'>{row.ncf}</TableCell>
              <TableCell className='font-mono text-xs text-muted-foreground'>{row.ncf_modificado || '—'}</TableCell>
              <TableCell className='text-xs'>{row.fecha}</TableCell>
              <TableCell className='text-right font-mono text-xs'>{row.itbis_facturado.toFixed(2)}</TableCell>
              <TableCell className='text-right font-mono text-xs font-semibold'>{row.total_facturado.toFixed(2)}</TableCell>
              <TableCell className='text-center font-mono text-xs'>{row.tipo_pago}</TableCell>
            </TableRow>
          ))}
          {rows.length > 0 && (
            <TableRow className='border-t-2 font-semibold bg-muted/40'>
              <TableCell colSpan={6} className='text-right'>TOTALES ({rows.length} registros)</TableCell>
              <TableCell className='text-right font-mono'>{totalItbis.toFixed(2)}</TableCell>
              <TableCell className='text-right font-mono'>{totalFacturado.toFixed(2)}</TableCell>
              <TableCell />
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  )
}
