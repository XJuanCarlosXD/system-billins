import { useEffect, useState } from 'react'
import { CreditCard, FileSpreadsheet } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props { noCia: string; punto: string }

type TipoPago = { tipo_pago: string; tipo_pago_fiscal: string; descripcion: string }

export function TiposPagoFat({ noCia, punto }: Props) {
  const [rows, setRows] = useState<TipoPago[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!noCia) return
    setLoading(true)
    regalGeneralApi.fatListTiposPago(noCia, punto)
      .then((d) => setRows(d.items as TipoPago[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [noCia, punto])

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, '')
    downloadCsv(
    'fat-tipos-pago.csv',
    ['Tipo Pago', 'Tipo Fiscal', 'Descripción'],
    rows.map((r) => [r.tipo_pago, r.tipo_pago_fiscal, r.descripcion]),
      meta,
    )
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <CreditCard className='h-5 w-5' /> Mantenimiento Tipos Pagos Fiscales
          </h2>
          <p className='text-sm text-muted-foreground'>FFAT137 — Empresa {noCia} · Punto {punto}</p>
        </div>
        <Button variant='outline' size='sm' onClick={exportCsv}>
          <FileSpreadsheet className='mr-1 h-4 w-4' /> Excel
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-24'>Tipo Pago</TableHead>
            <TableHead className='w-24'>Tipo Fiscal</TableHead>
            <TableHead>Descripción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={3} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={3} className='py-10 text-center text-muted-foreground'>No hay tipos de pago configurados.</TableCell></TableRow>}
          {rows.map((row) => (
            <TableRow key={row.tipo_pago}>
              <TableCell className='font-mono font-semibold'>{row.tipo_pago}</TableCell>
              <TableCell className='font-mono'>{row.tipo_pago_fiscal}</TableCell>
              <TableCell>{row.descripcion}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
