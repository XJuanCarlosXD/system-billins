import { useEffect, useState } from 'react'
import { ArrowRightLeft, CheckCircle2, RefreshCw } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Props { noCia: string; punto: string; ano: number; mes: number }

type FacturaPendiente = {
  no_factura: string; tipo_factura: string; fecha: string; nombre_cliente: string
  total_neto: number; impuesto: number
}

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export function GenerarAsientosFat({ noCia, punto, ano, mes }: Props) {
  const [rows, setRows] = useState<FacturaPendiente[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [result, setResult] = useState<{ generados: number; errores: number } | null>(null)

  const load = () => {
    if (!noCia) return
    setLoading(true)
    regalGeneralApi.fatGenerarAsientos(noCia, punto, ano, mes, 'preview')
      .then((d) => setRows(d.items as FacturaPendiente[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { setResult(null); load() }, [noCia, punto, ano, mes])

  const pendientes = rows

  const generar = async () => {
    setGenerating(true)
    try {
      const d = await regalGeneralApi.fatGenerarAsientos(noCia, punto, ano, mes, 'generar')
      setResult({ generados: d.generados ?? 0, errores: d.errores ?? 0 })
      setConfirm(false)
      load()
    } catch {
      // error visible via result state not updating
    } finally { setGenerating(false) }
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <ArrowRightLeft className='h-5 w-5' /> Generar Asientos CNT
          </h2>
          <p className='text-sm text-muted-foreground'>
            FAT → CNT · Empresa {noCia} · Punto {punto} · {MESES[mes]} {ano}
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='outline' size='sm' onClick={load}><RefreshCw className='mr-1 h-4 w-4' /> Actualizar</Button>
          {pendientes.length > 0 && !confirm && (
            <Button size='sm' onClick={() => setConfirm(true)}>
              <ArrowRightLeft className='mr-1 h-4 w-4' /> Generar {pendientes.length} asiento{pendientes.length !== 1 ? 's' : ''}
            </Button>
          )}
          {confirm && (
            <div className='flex items-center gap-2 rounded-md border bg-muted px-3 py-1.5'>
              <span className='text-sm font-medium'>¿Generar {pendientes.length} asientos?</span>
              <Button size='sm' onClick={generar} disabled={generating}>
                {generating ? 'Generando...' : 'Confirmar'}
              </Button>
              <Button size='sm' variant='outline' onClick={() => setConfirm(false)}>Cancelar</Button>
            </div>
          )}
        </div>
      </div>

      {result && (
        <div className='flex items-center gap-2 rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm dark:border-green-800 dark:bg-green-950'>
          <CheckCircle2 className='h-4 w-4 text-green-600 dark:text-green-400' />
          <span className='font-medium'>{result.generados} asiento{result.generados !== 1 ? 's' : ''} generado{result.generados !== 1 ? 's' : ''}
          {result.errores > 0 ? ` · ${result.errores} error${result.errores !== 1 ? 'es' : ''}` : ''}</span>
        </div>
      )}

      <div className='flex gap-4 text-sm'>
        <span><span className='font-semibold'>{pendientes.length}</span> pendientes</span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-24'>No. Factura</TableHead>
            <TableHead className='w-16 text-center'>Tipo</TableHead>
            <TableHead className='w-24'>Fecha</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className='w-28 text-right'>Total Neto</TableHead>
            <TableHead className='w-24 text-right'>ITBIS</TableHead>
            <TableHead className='w-28 text-right'>Total Bruto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>Sin facturas pendientes en este período.</TableCell></TableRow>}
          {rows.map((row) => (
            <TableRow key={row.no_factura}>
              <TableCell className='font-mono font-semibold'>{row.no_factura}</TableCell>
              <TableCell className='text-center'>
                <Badge variant='outline' className='text-xs'>{row.tipo_factura}</Badge>
              </TableCell>
              <TableCell className='text-sm'>{row.fecha}</TableCell>
              <TableCell className='text-sm'>{row.nombre_cliente || '—'}</TableCell>
              <TableCell className='text-right font-mono'>{row.total_neto.toFixed(2)}</TableCell>
              <TableCell className='text-right font-mono'>{row.impuesto.toFixed(2)}</TableCell>
              <TableCell className='text-right font-mono'>{(row.total_neto + row.impuesto).toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
