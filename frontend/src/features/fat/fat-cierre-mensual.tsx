import { useEffect, useState } from 'react'
import { CalendarCheck, Lock } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Props { noCia: string; punto: string; ano: number; mes: number }

type Cierre = {
  ano: number; mes: number
  fecha_cierre: string | null; fecha_sysdate: string | null; usuario: string
}

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export function CierreMensualFat({ noCia, punto, ano, mes }: Props) {
  const [rows, setRows] = useState<Cierre[]>([])
  const [loading, setLoading] = useState(false)
  const [closing, setClosing] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const load = () => {
    if (!noCia) return
    setLoading(true)
    regalGeneralApi.fatListCierres(noCia, punto)
      .then((d) => setRows(d.items as Cierre[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [noCia, punto])

  const isClosed = rows.some((r) => r.ano === ano && r.mes === mes)

  const doCierre = async () => {
    setClosing(true)
    try {
      await regalGeneralApi.fatCierreMensual(noCia, punto, ano, mes)
      setConfirm(false)
      load()
    } catch {
      // error handled silently — user will see data not change
    } finally { setClosing(false) }
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <CalendarCheck className='h-5 w-5' /> Cierre Mensual
          </h2>
          <p className='text-sm text-muted-foreground'>FFAT — Empresa {noCia} · Punto {punto}</p>
        </div>
        {!isClosed && !confirm && (
          <Button size='sm' variant='destructive' onClick={() => setConfirm(true)}>
            <Lock className='mr-1 h-4 w-4' /> Cerrar {MESES[mes]} {ano}
          </Button>
        )}
        {confirm && (
          <div className='flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2'>
            <span className='text-sm text-destructive font-medium'>¿Confirmar cierre de {MESES[mes]} {ano}?</span>
            <Button size='sm' variant='destructive' onClick={doCierre} disabled={closing}>
              {closing ? 'Cerrando...' : 'Sí, cerrar'}
            </Button>
            <Button size='sm' variant='outline' onClick={() => setConfirm(false)}>Cancelar</Button>
          </div>
        )}
      </div>

      {isClosed && (
        <div className='rounded-md border border-muted bg-muted/40 px-4 py-3 text-sm text-muted-foreground flex items-center gap-2'>
          <Lock className='h-4 w-4' /> El período {MESES[mes]} {ano} ya fue cerrado.
        </div>
      )}

      <div>
        <h3 className='text-sm font-semibold mb-2'>Historial de Cierres</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-20 text-center'>Año</TableHead>
              <TableHead className='w-28'>Mes</TableHead>
              <TableHead>Fecha Cierre</TableHead>
              <TableHead>Procesado</TableHead>
              <TableHead>Usuario</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={5} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={5} className='py-10 text-center text-muted-foreground'>Sin cierres registrados.</TableCell></TableRow>}
            {rows.map((row) => (
              <TableRow key={`${row.ano}-${row.mes}`}>
                <TableCell className='text-center font-mono'>{row.ano}</TableCell>
                <TableCell>
                  <Badge variant='secondary'>{MESES[row.mes]} {row.mes.toString().padStart(2, '0')}</Badge>
                </TableCell>
                <TableCell className='text-sm'>{row.fecha_cierre}</TableCell>
                <TableCell className='text-sm text-muted-foreground'>{row.fecha_sysdate}</TableCell>
                <TableCell className='text-sm'>{row.usuario}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
