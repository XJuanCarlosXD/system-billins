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

  const exportPdf = () => {
    // Print fino vía plantillas Puck (código cnt-grupos-contables).
    const qs = new URLSearchParams({ no_cia: noCia, punto }).toString()
    window.open(`/print/cnt-grupos-contables/current?${qs}`, '_blank')
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
