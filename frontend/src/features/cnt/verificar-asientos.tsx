import { useEffect, useState } from 'react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'

interface Props { noCia: string; punto: string; ano: number; mes: number }

const fmtN = (n: number) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function VerificarAsientos({ noCia, punto, ano, mes }: Props) {
  const { toast } = useToast()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [aprobando, setAprobando] = useState<Record<number, boolean>>({})
  const [aprobandoTodos, setAprobandoTodos] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await regalGeneralApi.cntAsientos(noCia, punto, ano, mes, {
        autorizado: false,
        pageSize: 200,
      })
      setItems(res.items || [])
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los asientos', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [noCia, punto, ano, mes])

  const aprobar = async (noAsiento: number) => {
    setAprobando(prev => ({ ...prev, [noAsiento]: true }))
    try {
      await regalGeneralApi.cntAprobar(noAsiento, { no_cia: noCia, punto, ano, mes })
      toast({ title: 'Aprobado', description: 'Asiento ' + noAsiento + ' aprobado' })
      setItems(prev => prev.filter(i => i.no_asiento !== noAsiento))
    } catch {
      toast({ title: 'Error', description: 'No se pudo aprobar el asiento ' + noAsiento, variant: 'destructive' })
    } finally {
      setAprobando(prev => ({ ...prev, [noAsiento]: false }))
    }
  }

  const aprobarTodos = async () => {
    setAprobandoTodos(true)
    const pending = [...items]
    for (const item of pending) {
      try {
        await regalGeneralApi.cntAprobar(item.no_asiento, { no_cia: noCia, punto, ano, mes })
        setItems(prev => prev.filter(i => i.no_asiento !== item.no_asiento))
      } catch {
        toast({ title: 'Error', description: 'Fallo aprobando asiento ' + item.no_asiento, variant: 'destructive' })
      }
    }
    setAprobandoTodos(false)
    toast({ title: 'Completado', description: 'Proceso de aprobacion finalizado' })
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>Verificacion de Asientos</h2>
          <p className='text-sm text-muted-foreground'>
            {loading ? 'Cargando...' : items.length + ' asiento' + (items.length !== 1 ? 's' : '') + ' pendiente' + (items.length !== 1 ? 's' : '') + ' de aprobar'}
          </p>
        </div>
        {items.length > 0 && (
          <Button
            size='sm'
            onClick={aprobarTodos}
            disabled={aprobandoTodos || Object.values(aprobando).some(Boolean)}
          >
            {aprobandoTodos ? 'Aprobando...' : 'Aprobar todos (' + items.length + ')'}
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-28'>No. Asiento</TableHead>
            <TableHead className='w-28'>Fecha</TableHead>
            <TableHead>Descripcion</TableHead>
            <TableHead className='w-36 text-right'>Debe</TableHead>
            <TableHead className='w-36 text-right'>Haber</TableHead>
            <TableHead className='w-28 text-right'>Diferencia</TableHead>
            <TableHead className='w-24 text-center'>Estado</TableHead>
            <TableHead className='w-28 text-center'>Accion</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell>
            </TableRow>
          )}
          {!loading && items.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>
                No hay asientos pendientes de aprobar para este periodo.
              </TableCell>
            </TableRow>
          )}
          {items.map(item => {
            const debe = Number(item.debe ?? item.total_debe ?? 0)
            const haber = Number(item.haber ?? item.total_haber ?? 0)
            const dif = Math.abs(debe - haber)
            return (
              <TableRow key={item.no_asiento}>
                <TableCell className='font-mono font-semibold'>{item.no_asiento}</TableCell>
                <TableCell className='text-sm'>{item.fecha ? String(item.fecha).slice(0, 10) : '—'}</TableCell>
                <TableCell className='text-sm max-w-xs truncate'>{item.descripcion ?? item.concepto ?? '—'}</TableCell>
                <TableCell className='text-right font-mono text-sm'>{fmtN(debe)}</TableCell>
                <TableCell className='text-right font-mono text-sm'>{fmtN(haber)}</TableCell>
                <TableCell className='text-right font-mono text-sm'>
                  <span className={dif > 0.01 ? 'text-red-600 font-bold' : 'text-green-600'}>{fmtN(dif)}</span>
                </TableCell>
                <TableCell className='text-center'>
                  <Badge variant={item.autorizado ? 'outline' : 'secondary'}>
                    {item.autorizado ? 'Aprobado' : 'Pendiente'}
                  </Badge>
                </TableCell>
                <TableCell className='text-center'>
                  <Button
                    size='sm' className='h-7 px-3'
                    disabled={!!aprobando[item.no_asiento] || item.autorizado}
                    onClick={() => aprobar(item.no_asiento)}
                  >
                    {aprobando[item.no_asiento] ? '...' : 'Aprobar'}
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </section>
  )
}
