import { useEffect, useMemo, useState } from 'react'
import { Printer, Search } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta } from './export-utils'

interface Props { noCia: string; punto: string }

export function GruposSucursal({ noCia, punto }: Props) {
  const [rows, setRows] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    regalGeneralApi.cntGruposContables()
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [noCia])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      String(r.grupo ?? '').toLowerCase().includes(q) ||
      String(r.descripcion ?? '').toLowerCase().includes(q)
    )
  }, [rows, search])

  const exportPdf = async () => {
    const now = new Date()
    const mesAno = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`
    const meta = await buildReportMeta(noCia, punto, mesAno)
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write([
      '<html><head><title>Grupos Contables</title>',
      '<style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}',
      'th,td{border:1px solid #ddd;padding:6px 10px;text-align:left}th{background:#f5f5f5}',
      'h2{margin-bottom:4px}p{margin:0 0 16px;color:#666;font-size:13px}</style></head><body>',
      '<h2>Grupos Contables Sucursal</h2>',
      '<p>' + ((meta as any).empresa ?? '') + ' | ' + punto + ' | ' + mesAno + '</p>',
      '<table><thead><tr><th>Grupo</th><th>Descripcion</th><th>Cuenta Inicio</th><th>Cuenta Fin</th></tr></thead>',
      '<tbody>',
      ...filteredRows.map(r =>
        '<tr><td>' + (r.grupo ?? '') + '</td><td>' + (r.descripcion ?? '') + '</td><td>' + (r.cuenta_inicio ?? '') + '</td><td>' + (r.cuenta_fin ?? '') + '</td></tr>'
      ),
      '</tbody></table></body></html>',
    ].join(''))
    win.print()
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>Grupos Contables Sucursal</h2>
          <p className='text-sm text-muted-foreground'>Grupos con rangos de cuentas.</p>
        </div>
        <Button variant='outline' size='sm' onClick={exportPdf}>
          <Printer className='mr-2 h-4 w-4' /> PDF
        </Button>
      </div>

      <div className='relative rounded-xl border p-4'>
        <Search className='absolute left-6 top-6 h-4 w-4 text-muted-foreground' />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder='Filtrar grupos...'
          className='h-9 pl-8'
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-24'>Grupo</TableHead>
            <TableHead>Descripcion</TableHead>
            <TableHead className='w-36'>Cuenta Inicio</TableHead>
            <TableHead className='w-36'>Cuenta Fin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={4} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell>
            </TableRow>
          )}
          {!loading && filteredRows.map((r, i) => (
            <TableRow key={r.grupo ?? i}>
              <TableCell className='font-mono font-semibold'>{r.grupo}</TableCell>
              <TableCell>{r.descripcion}</TableCell>
              <TableCell className='font-mono text-sm'>{r.cuenta_inicio}</TableCell>
              <TableCell className='font-mono text-sm'>{r.cuenta_fin}</TableCell>
            </TableRow>
          ))}
          {!loading && filteredRows.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className='py-10 text-center text-muted-foreground'>
                No hay grupos para ese filtro.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  )
}
