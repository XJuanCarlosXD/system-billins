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

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, `${String(mes).padStart(2, '0')}/${ano}`)
    downloadCsv(
    `fat-ncf-nulos-${ano}${String(mes).padStart(2, '0')}.csv`,
    ['NCF', 'Tipo NCF', 'Fecha Desde', 'Fecha Hasta', 'Motivo', 'Fecha Anulación', 'No. Factura'],
    rows.map((r) => [r.ncf, r.tipo_ncf, r.fecha_desde, r.fecha_hasta,
                     r.motivo_anulacion, r.fecha_anulacion, r.no_factura || '']),
      meta,
    )
  }

  const exportPdf = async () => {
    const meta = await buildReportMeta(noCia, punto, `${String(mes).padStart(2, '0')}/${ano}`)
    const win = window.open('', '_blank')!
    win.document.write(`<html><head><title>NCF Nulos / Anulados</title>
    <style>body{font-family:Arial,sans-serif;font-size:9px;padding:15px}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:2px 5px}
    th{background:#ddd;font-weight:bold}.hdr{margin-bottom:10px}h3{margin:0;font-size:13px}
    .sub{color:#666}</style></head><body>
    <div class="hdr"><h3>${meta.empresa}</h3>
    <div class="sub">NCF Nulos / Anulados · ${meta.periodo}</div>
    <div class="sub">Generado: ${meta.fecha}</div></div>
    <table><thead><tr><th>NCF</th><th>Tipo</th><th>Fecha Desde</th><th>Fecha Hasta</th>
    <th>Motivo</th><th>Fecha Anulación</th><th>Factura</th></tr></thead>
    <tbody>${rows.map((r) => `<tr>
    <td>${r.ncf}</td><td>${r.tipo_ncf}</td><td>${r.fecha_desde}</td><td>${r.fecha_hasta}</td>
    <td>${r.motivo_anulacion}</td><td>${r.fecha_anulacion}</td><td>${r.no_factura || ''}</td></tr>`).join('')}
    </tbody></table></body></html>`)
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
              <TableCell className='text-sm'>{row.fecha_desde}</TableCell>
              <TableCell className='text-sm'>{row.fecha_hasta}</TableCell>
              <TableCell className='text-sm'>{row.motivo_anulacion}</TableCell>
              <TableCell className='text-sm text-destructive'>{row.fecha_anulacion}</TableCell>
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
