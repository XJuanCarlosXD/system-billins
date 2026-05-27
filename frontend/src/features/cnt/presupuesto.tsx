import { useState } from 'react'
import { FileSpreadsheet, Printer, RefreshCw } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv, fmtN, printHtml } from './export-utils'

interface Props { noCia: string; punto: string; ano: number; mes: number }

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MES_KEYS = ['mes_01','mes_02','mes_03','mes_04','mes_05','mes_06','mes_07','mes_08','mes_09','mes_10','mes_11','mes_12']

function buildPresupuestoPdf(meta: import('./export-utils').ReportMeta, rows: any[], ano: number) {
  const fmt = (v: number) => fmtN(v)
  const headerCols = MESES.map(m => `<th style="text-align:right;padding:2px 6px;font-size:10px">${m}</th>`).join('')
  const totalRow = MES_KEYS.reduce((acc, k) => {
    acc[k] = rows.reduce((s, r) => s + (r[k] || 0), 0)
    return acc
  }, {} as Record<string, number>)
  totalRow['total_anual'] = rows.reduce((s, r) => s + (r.total_anual || 0), 0)

  const bodyRows = rows.map(r => {
    const meses = MES_KEYS.map(k => `<td style="text-align:right;font-family:monospace;font-size:10px;padding:2px 6px">${fmt(r[k])}</td>`).join('')
    return `<tr>
      <td style="font-family:monospace;padding:2px 4px;font-size:10px">${r.cuenta}</td>
      <td style="padding:2px 4px;font-size:10px">${r.descripcion}</td>
      ${meses}
      <td style="text-align:right;font-family:monospace;font-size:10px;font-weight:bold;padding:2px 6px">${fmt(r.total_anual)}</td>
    </tr>`
  }).join('')

  const footMeses = MES_KEYS.map(k => `<td style="text-align:right;font-family:monospace;font-size:10px;font-weight:bold;padding:2px 6px">${fmt(totalRow[k])}</td>`).join('')

  const body = `
    <h3 style="text-align:center;margin:8px 0;font-size:13px">PRESUPUESTO ANUAL ${ano}</h3>
    <table style="width:100%;border-collapse:collapse;border:1px solid #ccc">
      <thead>
        <tr style="background:#f0f0f0">
          <th style="text-align:left;padding:3px 4px;font-size:10px">Cuenta</th>
          <th style="text-align:left;padding:3px 4px;font-size:10px">Descripcion</th>
          ${headerCols}
          <th style="text-align:right;padding:3px 6px;font-size:10px">Total</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
      <tfoot>
        <tr style="background:#e8e8e8;font-weight:bold">
          <td colspan="2" style="padding:3px 4px;font-size:10px">TOTALES</td>
          ${footMeses}
          <td style="text-align:right;font-family:monospace;font-size:10px;font-weight:bold;padding:2px 6px">${fmt(totalRow['total_anual'])}</td>
        </tr>
      </tfoot>
    </table>
  `
  printHtml(`Presupuesto ${ano} - ${meta.company}`, body)
}

export function PresupuestoAnual({ noCia, punto, ano }: Omit<Props, 'mes'> & { ano: number }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    regalGeneralApi.cntPresupuesto(noCia, punto, ano)
      .then(setRows)
      .finally(() => setLoading(false))
  }

  const fmt = (v: any) => Number(v || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })

  const totales = MES_KEYS.reduce((acc, k) => {
    acc[k] = rows.reduce((s, r) => s + (r[k] || 0), 0)
    return acc
  }, {} as Record<string, number>)
  totales['total_anual'] = rows.reduce((s, r) => s + (r.total_anual || 0), 0)

  const exportCsv = () => {
    const headers = ['Cuenta', 'Descripcion', 'Tipo', 'Clase', ...MESES, 'Total']
    const data = rows.map(r => [r.cuenta, r.descripcion, r.tipo, r.clase, ...MES_KEYS.map(k => r[k] || 0), r.total_anual || 0])
    downloadCsv(`cnt-presupuesto-${noCia}-${punto}-${ano}.csv`, headers, data)
  }

  const exportPdf = async () => {
    const meta = await buildReportMeta(noCia, punto, String(ano))
    buildPresupuestoPdf(meta, rows, ano)
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>Presupuesto Anual</h2>
          <p className='text-sm text-muted-foreground'>Ano {ano} — empresa y punto activos.</p>
        </div>
        <div className='flex flex-wrap gap-2'>
          {rows.length > 0 && (
            <>
              <Button variant='outline' size='sm' onClick={exportPdf}>
                <Printer className='mr-2 h-4 w-4' /> PDF
              </Button>
              <Button variant='outline' size='sm' onClick={exportCsv}>
                <FileSpreadsheet className='mr-2 h-4 w-4' /> Excel
              </Button>
            </>
          )}
          <Button size='sm' onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {rows.length > 0 ? 'Actualizar' : 'Generar'}
          </Button>
        </div>
      </div>

      {rows.length > 0 ? (
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuenta</TableHead>
                <TableHead>Descripcion</TableHead>
                <TableHead className='text-center'>Cl</TableHead>
                {MESES.map((m, i) => (
                  <TableHead key={i} className='text-right text-xs'>{m}</TableHead>
                ))}
                <TableHead className='text-right font-bold'>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.cuenta}>
                  <TableCell className='font-mono text-xs'>{row.cuenta}</TableCell>
                  <TableCell className='text-xs'>{row.descripcion}</TableCell>
                  <TableCell className='text-center text-xs'>{row.clase}</TableCell>
                  {MES_KEYS.map((k, i) => (
                    <TableCell key={i} className='text-right font-mono text-xs'>
                      {row[k] > 0 ? fmt(row[k]) : ''}
                    </TableCell>
                  ))}
                  <TableCell className='text-right font-mono text-xs font-bold'>{fmt(row.total_anual)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>Totales</TableCell>
                {MES_KEYS.map((k, i) => (
                  <TableCell key={i} className='text-right font-mono text-xs'>{fmt(totales[k])}</TableCell>
                ))}
                <TableCell className='text-right font-mono text-xs font-bold'>{fmt(totales['total_anual'])}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      ) : (
        !loading && (
          <div className='rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground'>
            Presiona Generar para consultar el presupuesto anual.
          </div>
        )
      )}
    </section>
  )
}