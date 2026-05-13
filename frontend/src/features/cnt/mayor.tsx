import { useMemo, useState } from 'react'
import { FileSpreadsheet, Printer, Search } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv, printHtml } from './export-utils'

interface Props { noCia: string; punto: string; ano: number; mes: number }

const meses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function MayorCuenta({ noCia, punto, ano }: Props) {
  const [cuenta, setCuenta] = useState('')
  const [search, setSearch] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [mesIni, setMesIni] = useState(1)
  const [mesFin, setMesFin] = useState(12)
  const [result, setResult] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [rowSearch, setRowSearch] = useState('')
  const [page, setPage] = useState(1)

  const fmt = (value: any) => Number(value || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })

  const searchCuenta = async (value: string) => {
    setSearch(value)
    if (!value.trim()) {
      setSuggestions([])
      return
    }
    const rows = await regalGeneralApi.cntCatalogo({ search: value })
    setSuggestions(rows.slice(0, 8))
  }

  const selectCuenta = (row: any) => {
    setCuenta(row.cuenta)
    setSearch(`${row.cuenta} - ${row.descripcion}`)
    setSuggestions([])
  }

  const load = async () => {
    if (!cuenta) return
    setLoading(true)
    setPage(1)
    regalGeneralApi.cntMayor(noCia, punto, cuenta, ano, mesIni, mesFin)
      .then(setResult)
      .finally(() => setLoading(false))
  }

  const filteredRows = useMemo(() => {
    const rows = result?.movimientos || []
    if (!rowSearch.trim()) return rows
    const query = rowSearch.toLowerCase()
    return rows.filter((row: any) =>
      String(row.no_asiento || '').toLowerCase().includes(query) ||
      String(row.detalle || '').toLowerCase().includes(query) ||
      String(row.tipo_movi || '').toLowerCase().includes(query),
    )
  }, [result, rowSearch])

  const pagedRows = useMemo(() => {
    const pageSize = 25
    const start = (page - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / 25))

  const exportExcel = () => {
    if (!result) return
    downloadCsv(
      `cnt-mayor-${cuenta}-${ano}-${mesIni}-${mesFin}.csv`,
      ['No.', 'Fecha', 'Detalle', 'Tipo', 'Monto', 'Saldo'],
      filteredRows.map((row: any) => [
        row.no_asiento,
        row.fecha ? String(row.fecha).slice(0, 10) : '',
        row.detalle,
        row.tipo_movi,
        row.monto,
        row.saldo_acumulado,
      ]),
    )
  }

  const exportPdf = () => {
    if (!result) return
    const body = `
      <table>
        <thead>
          <tr>
            <th>No.</th>
            <th>Fecha</th>
            <th>Detalle</th>
            <th>Debito</th>
            <th>Credito</th>
            <th>Saldo</th>
          </tr>
        </thead>
        <tbody>
          ${filteredRows.map((row: any) => `
            <tr>
              <td>${row.no_asiento ?? ''}</td>
              <td>${row.fecha ? String(row.fecha).slice(0, 10) : ''}</td>
              <td>${row.detalle ?? ''}</td>
              <td class="numeric">${row.tipo_movi === 'D' ? fmt(row.monto) : ''}</td>
              <td class="numeric">${row.tipo_movi === 'C' ? fmt(row.monto) : ''}</td>
              <td class="numeric">${fmt(row.saldo_acumulado)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    printHtml(`Mayor ${cuenta} ${ano}`, body)
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>Mayor general</h2>
          <p className='text-sm text-muted-foreground'>Consulta por cuenta con filtro local, paginacion y exportacion.</p>
        </div>
        {result && (
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' size='sm' onClick={exportPdf}>
              <Printer className='mr-2 h-4 w-4' /> PDF
            </Button>
            <Button variant='outline' size='sm' onClick={exportExcel}>
              <FileSpreadsheet className='mr-2 h-4 w-4' /> Excel
            </Button>
          </div>
        )}
      </div>

      <div className='flex flex-wrap items-end gap-3 rounded-lg border p-4'>
        <div className='relative min-w-72 flex-1'>
          <label className='mb-1 block text-xs font-medium'>Cuenta</label>
          <Input value={search} onChange={(event) => searchCuenta(event.target.value)} placeholder='Buscar cuenta...' className='h-9' />
          {suggestions.length > 0 && (
            <div className='absolute inset-x-0 top-[74px] z-20 max-h-56 overflow-auto rounded-lg border bg-background shadow-sm'>
              {suggestions.map((row) => (
                <button
                  key={row.cuenta}
                  type='button'
                  className='block w-full border-b px-3 py-2 text-left text-sm hover:bg-muted'
                  onMouseDown={() => selectCuenta(row)}
                >
                  <span className='mr-2 font-mono'>{row.cuenta}</span>
                  {row.descripcion}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className='mb-1 block text-xs font-medium'>Mes inicial</label>
          <Select value={String(mesIni)} onValueChange={(value) => setMesIni(Number(value))}>
            <SelectTrigger className='h-9 w-28'><SelectValue /></SelectTrigger>
            <SelectContent>{meses.slice(1).map((name, index) => <SelectItem key={index + 1} value={String(index + 1)}>{name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className='mb-1 block text-xs font-medium'>Mes final</label>
          <Select value={String(mesFin)} onValueChange={(value) => setMesFin(Number(value))}>
            <SelectTrigger className='h-9 w-28'><SelectValue /></SelectTrigger>
            <SelectContent>{meses.slice(1).map((name, index) => <SelectItem key={index + 1} value={String(index + 1)}>{name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button size='sm' className='h-9' onClick={load} disabled={loading || !cuenta}>
          <Search className='mr-2 h-4 w-4' /> Consultar
        </Button>
      </div>

      {result && (
        <div className='space-y-3'>
          <div className='grid gap-3 rounded-xl border p-4 md:grid-cols-[minmax(0,1fr)_280px]'>
            <div className='text-sm font-medium'>
              {result.cuenta?.cuenta} - {result.cuenta?.descripcion}
            </div>
            <Input
              value={rowSearch}
              onChange={(event) => {
                setPage(1)
                setRowSearch(event.target.value)
              }}
              placeholder='Filtrar movimientos...'
              className='h-9'
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No.</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead className='text-right'>Debito</TableHead>
                <TableHead className='text-right'>Credito</TableHead>
                <TableHead className='text-right'>Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.map((row: any, index: number) => (
                <TableRow key={`${row.no_asiento}-${index}`}>
                  <TableCell className='font-mono'>{row.no_asiento}</TableCell>
                  <TableCell>{row.fecha ? String(row.fecha).slice(0, 10) : ''}</TableCell>
                  <TableCell className='max-w-md truncate'>{row.detalle}</TableCell>
                  <TableCell className='text-right font-mono'>{row.tipo_movi === 'D' ? fmt(row.monto) : ''}</TableCell>
                  <TableCell className='text-right font-mono'>{row.tipo_movi === 'C' ? fmt(row.monto) : ''}</TableCell>
                  <TableCell className='text-right font-mono'>{fmt(row.saldo_acumulado)}</TableCell>
                </TableRow>
              ))}
              {pagedRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className='py-8 text-center text-muted-foreground'>Sin movimientos para ese filtro.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className='flex items-center justify-between text-sm'>
            <span className='text-muted-foreground'>Pagina {page} de {totalPages}</span>
            <div className='flex gap-2'>
              <Button variant='outline' size='sm' disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Anterior</Button>
              <Button variant='outline' size='sm' disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente</Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
