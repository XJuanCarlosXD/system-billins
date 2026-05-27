import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { regalGeneralApi } from '@/lib/regal-general-api'

interface Props { noCia: string; punto: string; ano: number; mes: number }

export function PeriodosFiscales({ noCia, punto, ano, mes }: Props) {
  const [data, setData] = useState<{ puntos: any[]; cierres: any[]; years?: number[]; rangos?: Record<string, any> }>({
    puntos: [],
    cierres: [],
    years: [],
    rangos: {},
  })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    regalGeneralApi.cntPeriodos(noCia).then(setData).catch(() => {})
  }, [noCia])

  const meses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  const filteredCierres = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return data.cierres
    return data.cierres.filter((row) =>
      String(row.punto || '').toLowerCase().includes(query) ||
      String(row.ano || '').toLowerCase().includes(query) ||
      String(row.mes || '').toLowerCase().includes(query),
    )
  }, [data.cierres, search])

  const pagedCierres = useMemo(() => {
    const start = (page - 1) * 12
    return filteredCierres.slice(start, start + 12)
  }, [filteredCierres, page])

  const totalPages = Math.max(1, Math.ceil(filteredCierres.length / 12))

  return (
    <div className='space-y-4'>
      <div>
        <h2 className='text-lg font-semibold'>Periodos y cierres</h2>
        <p className='text-sm text-muted-foreground'>Muestra el proceso activo y los rangos reales disponibles por fuente contable.</p>
      </div>

      <div className='grid gap-3 md:grid-cols-3'>
        <RangeCard title='Cierres' data={data.rangos?.cierres} />
        <RangeCard title='Balance / Hcuenta' data={data.rangos?.hcuenta} />
        <RangeCard title='Asientos' data={data.rangos?.asientos} />
      </div>

      <div className='flex flex-wrap items-center gap-2 text-sm text-muted-foreground'>
        <span>Anos visibles:</span>
        {(data.years || []).map((year) => (
          <Badge key={year} variant='outline'>{year}</Badge>
        ))}
      </div>

      <div className='grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]'>
        <div className='rounded-xl border'>
          <div className='border-b p-3 text-sm font-medium'>Puntos de proceso</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Punto</TableHead>
                <TableHead className='text-center'>Ano</TableHead>
                <TableHead className='text-center'>Mes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.puntos.map((row) => (
                <TableRow key={row.punto}>
                  <TableCell className='font-mono'>{row.punto}</TableCell>
                  <TableCell className='text-center'>{row.ano_proceso}</TableCell>
                  <TableCell className='text-center'>{meses[row.mes_proceso]}</TableCell>
                </TableRow>
              ))}
              {data.puntos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className='py-8 text-center text-muted-foreground'>Sin puntos configurados.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className='space-y-3 rounded-xl border p-4'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='text-sm font-medium'>Cierres de periodo</div>
            <Input
              value={search}
              onChange={(event) => {
                setPage(1)
                setSearch(event.target.value)
              }}
              placeholder='Filtrar cierres...'
              className='h-9 w-full max-w-xs'
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Punto</TableHead>
                <TableHead className='text-center'>Ano</TableHead>
                <TableHead className='text-center'>Mes</TableHead>
                <TableHead>Fecha cierre</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedCierres.map((row, index) => (
                <TableRow key={`${row.punto}-${row.ano}-${row.mes}-${index}`}>
                  <TableCell className='font-mono'>{row.punto}</TableCell>
                  <TableCell className='text-center'>{row.ano}</TableCell>
                  <TableCell className='text-center'>{meses[row.mes]}</TableCell>
                  <TableCell>{row.fecha_cierre ? String(row.fecha_cierre).substring(0, 10) : ''}</TableCell>
                </TableRow>
              ))}
              {pagedCierres.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className='py-8 text-center text-muted-foreground'>Sin cierres para ese filtro.</TableCell>
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
      </div>
    </div>
  )
}

function RangeCard({ title, data }: { title: string; data?: Record<string, any> }) {
  return (
    <div className='rounded-xl border p-4'>
      <div className='text-sm font-medium'>{title}</div>
      <div className='mt-2 flex items-center gap-2 text-sm text-muted-foreground'>
        <span>Min: {data?.min_ano ?? '-'}</span>
        <span>Max: {data?.max_ano ?? '-'}</span>
        <Badge variant='outline'>{data?.total ?? 0} registros</Badge>
      </div>
    </div>
  )
}
