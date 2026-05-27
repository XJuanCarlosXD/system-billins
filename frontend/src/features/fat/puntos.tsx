import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Props { noCia: string }

type Punto = {
  no_cia: string; punto: string; descripcion: string
  max_descuento: number; activo: boolean; ano_proceso: number; mes_proceso: number
}

export function PuntosTrabajoFat({ noCia }: Props) {
  const [rows, setRows] = useState<Punto[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!noCia) return
    setLoading(true)
    regalGeneralApi.fatListPuntos(noCia)
      .then((d) => setRows(d.items as Punto[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [noCia])

  return (
    <section className='space-y-4'>
      <div>
        <h2 className='text-lg font-semibold flex items-center gap-2'>
          <MapPin className='h-5 w-5' /> Puntos de Trabajo
        </h2>
        <p className='text-sm text-muted-foreground'>FFAT102 — Empresa {noCia} — Configuración de puntos</p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-16'>Punto</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className='w-28 text-right'>Máx. Desc. %</TableHead>
            <TableHead className='w-20 text-center'>Año Proceso</TableHead>
            <TableHead className='w-20 text-center'>Mes Proceso</TableHead>
            <TableHead className='w-20 text-center'>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>No hay puntos configurados para esta empresa.</TableCell></TableRow>}
          {rows.map((row) => (
            <TableRow key={`${row.no_cia}-${row.punto}`}>
              <TableCell className='font-mono font-semibold'>{row.punto}</TableCell>
              <TableCell className='font-medium'>{row.descripcion}</TableCell>
              <TableCell className='text-right'>{row.max_descuento}%</TableCell>
              <TableCell className='text-center font-mono'>{row.ano_proceso || '—'}</TableCell>
              <TableCell className='text-center font-mono'>{row.mes_proceso || '—'}</TableCell>
              <TableCell className='text-center'>
                <Badge variant={row.activo ? 'default' : 'secondary'}>{row.activo ? 'Activo' : 'Inactivo'}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
