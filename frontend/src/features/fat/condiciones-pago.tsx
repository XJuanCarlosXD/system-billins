import { useEffect, useState } from 'react'
import { FileSpreadsheet, Printer } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv, printCondicionesPago } from './fat-export'

interface Props { noCia: string; punto: string }

type Condicion = {
  no_condicion_pago: string
  descripcion: string
  plazo_pago: number
  porciento: number
  activa: boolean
}

export function CondicionesPago({ noCia, punto }: Props) {
  const [rows, setRows] = useState<Condicion[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    regalGeneralApi.fatListCondicionesPago()
      .then((d) => setRows(d.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const exportPdf = async () => {
    const meta = await buildReportMeta(noCia, punto, '')
    printCondicionesPago(meta, rows)
  }

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, '')
    downloadCsv(
      'fat-condiciones-pago.csv',
      ['Código', 'Descripción', 'Plazo (días)', '% Dto.Pronto', 'Activa'],
      rows.map((r) => [r.no_condicion_pago, r.descripcion, r.plazo_pago, r.porciento, r.activa ? 'S' : 'N']),
      meta,
    )
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>Condiciones de Pago</h2>
          <p className='text-sm text-muted-foreground'>Catálogo global de plazos y condiciones de pago</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={exportPdf}><Printer className='mr-2 h-4 w-4' /> PDF</Button>
          <Button variant='outline' size='sm' onClick={exportCsv}><FileSpreadsheet className='mr-2 h-4 w-4' /> Excel</Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-32'>Código</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className='w-28 text-right'>Plazo (días)</TableHead>
            <TableHead className='w-28 text-right'>% Dto. Pronto</TableHead>
            <TableHead className='w-24 text-center'>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow><TableCell colSpan={5} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>
          )}
          {!loading && rows.length === 0 && (
            <TableRow><TableCell colSpan={5} className='py-10 text-center text-muted-foreground'>No hay condiciones de pago registradas.</TableCell></TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.no_condicion_pago}>
              <TableCell className='font-mono font-semibold'>{row.no_condicion_pago}</TableCell>
              <TableCell>{row.descripcion}</TableCell>
              <TableCell className='text-right'>{row.plazo_pago}</TableCell>
              <TableCell className='text-right'>{row.porciento ? `${row.porciento}%` : '—'}</TableCell>
              <TableCell className='text-center'>
                <Badge variant={row.activa ? 'default' : 'secondary'}>{row.activa ? 'Activa' : 'Inactiva'}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <p className='text-xs text-muted-foreground'>Total: {rows.length} condición(es)</p>
    </section>
  )
}
