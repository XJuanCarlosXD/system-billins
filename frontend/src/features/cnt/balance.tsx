import { useState } from 'react'
import { FileSpreadsheet, Printer, RefreshCw } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv, printHtml } from './export-utils'

interface Props { noCia: string; punto: string; ano: number; mes: number }

export function BalanceComprobacion({ noCia, punto, ano, mes }: Props) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    regalGeneralApi.cntBalance(noCia, punto, ano, mes).then(setRows).finally(() => setLoading(false))
  }

  const fmt = (value: any) => Number(value || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })
  const totD = rows.reduce((sum, row) => sum + Number(row.debitos || 0), 0)
  const totC = rows.reduce((sum, row) => sum + Number(row.creditos || 0), 0)
  const totSD = rows.reduce((sum, row) => sum + Number(row.saldo_d || 0), 0)
  const totSC = rows.reduce((sum, row) => sum + Number(row.saldo_c || 0), 0)

  const exportExcel = () => {
    downloadCsv(
      `cnt-balance-${noCia}-${punto}-${ano}-${mes}.csv`,
      ['Cuenta', 'Descripcion', 'Clase', 'Debitos', 'Creditos', 'Saldo D', 'Saldo C'],
      rows.map((row) => [row.cuenta, row.descripcion, row.clase, row.debitos, row.creditos, row.saldo_d, row.saldo_c]),
    )
  }

  const exportPdf = () => {
    const body = `
      <table>
        <thead>
          <tr>
            <th>Cuenta</th>
            <th>Descripcion</th>
            <th>Clase</th>
            <th>Debitos</th>
            <th>Creditos</th>
            <th>Saldo D</th>
            <th>Saldo C</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${row.cuenta ?? ''}</td>
              <td>${row.descripcion ?? ''}</td>
              <td>${row.clase ?? ''}</td>
              <td class="numeric">${fmt(row.debitos)}</td>
              <td class="numeric">${fmt(row.creditos)}</td>
              <td class="numeric">${row.saldo_d > 0 ? fmt(row.saldo_d) : ''}</td>
              <td class="numeric">${row.saldo_c > 0 ? fmt(row.saldo_c) : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    printHtml(`Balance de comprobacion ${ano}/${String(mes).padStart(2, '0')}`, body)
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>Balance de comprobacion</h2>
          <p className='text-sm text-muted-foreground'>{ano}/{String(mes).padStart(2, '0')} para la empresa y punto activos.</p>
        </div>
        <div className='flex flex-wrap gap-2'>
          {rows.length > 0 && (
            <>
              <Button variant='outline' size='sm' onClick={exportPdf}>
                <Printer className='mr-2 h-4 w-4' /> PDF
              </Button>
              <Button variant='outline' size='sm' onClick={exportExcel}>
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuenta</TableHead>
              <TableHead>Descripcion</TableHead>
              <TableHead className='text-center'>Clase</TableHead>
              <TableHead className='text-right'>Debitos</TableHead>
              <TableHead className='text-right'>Creditos</TableHead>
              <TableHead className='text-right'>Saldo D</TableHead>
              <TableHead className='text-right'>Saldo C</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.cuenta}>
                <TableCell className='font-mono'>{row.cuenta}</TableCell>
                <TableCell>{row.descripcion}</TableCell>
                <TableCell className='text-center font-mono'>{row.clase}</TableCell>
                <TableCell className='text-right font-mono'>{fmt(row.debitos)}</TableCell>
                <TableCell className='text-right font-mono'>{fmt(row.creditos)}</TableCell>
                <TableCell className='text-right font-mono'>{row.saldo_d > 0 ? fmt(row.saldo_d) : ''}</TableCell>
                <TableCell className='text-right font-mono'>{row.saldo_c > 0 ? fmt(row.saldo_c) : ''}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>Totales</TableCell>
              <TableCell className='text-right font-mono'>{fmt(totD)}</TableCell>
              <TableCell className='text-right font-mono'>{fmt(totC)}</TableCell>
              <TableCell className='text-right font-mono'>{fmt(totSD)}</TableCell>
              <TableCell className='text-right font-mono'>{fmt(totSC)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      ) : (
        !loading && (
          <div className='rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground'>
            Presiona Generar para consultar el balance.
          </div>
        )
      )}
    </section>
  )
}
