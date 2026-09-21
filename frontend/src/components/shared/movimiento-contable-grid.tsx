// Grilla de distribución contable reutilizable (Cuenta / Nombre Cuenta /
// Centro Costo / Débito / Crédito), con búsqueda de cuenta contable.
//
// Extraído de CxP — Entrada de Documentos (Fcxp201/Fcxp210 en el legado, que
// maneja esta sección como una grilla real de varias líneas, no un campo de
// solo lectura). Reutilizado también en Caja Chica (Facc201), donde datos
// reales del legado muestran que el 80% de los egresos corrigen la cuenta
// sugerida por el tipo de gasto y el 10% reparte el gasto entre 2-3 cuentas.
import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { regalGeneralApi as api } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export type LineaContable = {
  cuenta: string
  centroCosto: string
  debito: string
  credito: string
}

export function filaVacia(): LineaContable {
  return { cuenta: '', centroCosto: '', debito: '', credito: '' }
}

export function MovimientoContableGrid({
  lineas,
  onChange,
  soloDebito = false,
  totalEsperado,
  titulo = 'Movimiento Contable (Distribución del documento)',
}: {
  lineas: LineaContable[]
  onChange: (lineas: LineaContable[]) => void
  /** Oculta la columna Crédito — para pantallas donde el crédito es fijo
   * (ej. Caja Chica: siempre la cuenta de la caja) y esta grilla solo reparte
   * el débito entre una o varias cuentas de gasto. */
  soloDebito?: boolean
  /** Cuando soloDebito=true, valor contra el que se compara la suma de las
   * líneas para mostrar la Diferencia (ej. el "Valor" del egreso). */
  totalEsperado?: number
  titulo?: string
}) {
  const [nombres, setNombres] = useState<Record<string, string>>({})
  const [buscarIdx, setBuscarIdx] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  const cuentasEnUso = useMemo(
    () => Array.from(new Set(lineas.map((l) => l.cuenta).filter(Boolean))),
    [lineas],
  )
  useEffect(() => {
    const faltantes = cuentasEnUso.filter((c) => !(c in nombres))
    if (faltantes.length === 0) return
    faltantes.forEach((c) => {
      api.cntGetCuenta(c)
        .then((r: any) => setNombres((n) => ({ ...n, [c]: r?.descripcion || r?.nombre || '' })))
        .catch(() => setNombres((n) => ({ ...n, [c]: '' })))
    })
  }, [cuentasEnUso]) // eslint-disable-line react-hooks/exhaustive-deps

  const actualizar = (i: number, patch: Partial<LineaContable>) => {
    const copia = lineas.slice()
    copia[i] = { ...copia[i], ...patch }
    onChange(copia)
  }
  const agregarFila = () => onChange([...lineas, filaVacia()])
  const quitarFila = (i: number) => onChange(lineas.length <= 1 ? [filaVacia()] : lineas.filter((_, idx) => idx !== i))

  const totalDebito = lineas.reduce((s, l) => s + Number(l.debito || 0), 0)
  const totalCredito = lineas.reduce((s, l) => s + Number(l.credito || 0), 0)
  const diferencia = soloDebito ? totalDebito - Number(totalEsperado ?? totalDebito) : totalDebito - totalCredito

  const buscar = async (q: string) => {
    if (q.trim().length < 1) { setResults([]); return }
    setSearching(true)
    try {
      setResults(await api.cntCatalogo({ search: q, activa: true }))
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const aplicar = (c: any) => {
    if (buscarIdx == null) return
    actualizar(buscarIdx, { cuenta: c.cuenta })
    setNombres((n) => ({ ...n, [c.cuenta]: c.descripcion }))
    setBuscarIdx(null)
    setSearch('')
    setResults([])
  }

  return (
    <div className='space-y-2'>
      <Label className='text-sm font-medium'>{titulo}</Label>
      <div className='overflow-x-auto rounded-lg border'>
        <Table>
          <TableHeader className='bg-muted/40'>
            <TableRow>
              <TableHead className='w-36 py-3'>Cuenta</TableHead>
              <TableHead className='py-3'>Nombre Cuenta</TableHead>
              <TableHead className='w-32 py-3'>Centro Costo</TableHead>
              <TableHead className='w-32 py-3 text-right'>{soloDebito ? 'Monto' : 'Débito'}</TableHead>
              {!soloDebito && <TableHead className='w-32 py-3 text-right'>Crédito</TableHead>}
              <TableHead className='w-10' />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineas.map((l, i) => (
              <TableRow key={i}>
                <TableCell className='p-2'>
                  <div className='flex items-center gap-1.5'>
                    <Input
                      value={l.cuenta}
                      onChange={(e) => actualizar(i, { cuenta: e.target.value })}
                      className='h-10 w-28 font-mono text-sm'
                      placeholder='2104-02'
                    />
                    <Button
                      type='button' variant='outline' size='sm' className='h-10 px-2.5'
                      title='Buscar cuenta'
                      onClick={() => { setBuscarIdx(i); setSearch(''); setResults([]) }}
                    >
                      <Search className='h-3.5 w-3.5' />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className='truncate p-2 text-sm text-muted-foreground'>
                  {l.cuenta ? (nombres[l.cuenta] ?? '…') : ''}
                </TableCell>
                <TableCell className='p-2'>
                  <Input
                    value={l.centroCosto}
                    onChange={(e) => actualizar(i, { centroCosto: e.target.value })}
                    className='h-10 font-mono text-sm'
                  />
                </TableCell>
                <TableCell className='p-2'>
                  <Input
                    type='number' step='0.01'
                    value={l.debito}
                    onChange={(e) => actualizar(i, {
                      debito: e.target.value,
                      credito: !soloDebito && e.target.value ? '' : l.credito,
                    })}
                    className='h-10 text-right font-mono text-sm'
                  />
                </TableCell>
                {!soloDebito && (
                  <TableCell className='p-2'>
                    <Input
                      type='number' step='0.01'
                      value={l.credito}
                      onChange={(e) => actualizar(i, { credito: e.target.value, debito: e.target.value ? '' : l.debito })}
                      className='h-10 text-right font-mono text-sm'
                    />
                  </TableCell>
                )}
                <TableCell className='p-2'>
                  <button
                    type='button'
                    onClick={() => quitarFila(i)}
                    className='text-muted-foreground hover:text-red-600'
                    title='Quitar línea'
                  >
                    ×
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className='flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2'>
        <Button type='button' variant='outline' size='sm' onClick={agregarFila}>
          + Línea
        </Button>
        <div className='flex gap-5 text-sm'>
          {soloDebito ? (
            <span>Total: <b className='font-mono'>{fmt(totalDebito)}</b></span>
          ) : (
            <>
              <span>Total Débito: <b className='font-mono'>{fmt(totalDebito)}</b></span>
              <span>Total Crédito: <b className='font-mono'>{fmt(totalCredito)}</b></span>
            </>
          )}
          <span className={diferencia !== 0 ? 'font-semibold text-red-600' : 'font-semibold text-emerald-700'}>
            Diferencia: <b className='font-mono'>{fmt(diferencia)}</b>
          </span>
        </div>
      </div>

      <Dialog open={buscarIdx != null} onOpenChange={(o) => !o && setBuscarIdx(null)}>
        <DialogContent className='flex h-auto max-h-[80vh] min-h-[40vh] w-[90vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-h-[80vh] sm:max-w-none lg:w-[50vw]'>
          <DialogHeader className='shrink-0 border-b px-6 py-4'>
            <DialogTitle>Buscar Cuenta Contable</DialogTitle>
          </DialogHeader>
          <div className='shrink-0 border-b bg-background px-6 py-3'>
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); buscar(e.target.value) }}
              placeholder='Buscar por código o nombre de la cuenta…'
              className='h-11 text-base'
              autoFocus
            />
          </div>
          <div className='flex-1 overflow-auto px-6 py-2'>
            <Table>
              <TableHeader className='sticky top-0 z-10 bg-background'>
                <TableRow>
                  <TableHead className='w-32'>Cuenta</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className='w-24 text-center'>Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className='py-12 text-center text-gray-400'>
                      {searching ? 'Buscando…' : search.length >= 1 ? 'Sin resultados' : 'Escriba para buscar'}
                    </TableCell>
                  </TableRow>
                )}
                {results.map((c: any) => (
                  <TableRow key={c.cuenta} className='cursor-pointer hover:bg-blue-50' onDoubleClick={() => aplicar(c)}>
                    <TableCell className='font-mono font-semibold'>{c.cuenta}</TableCell>
                    <TableCell className='font-medium'>{c.descripcion}</TableCell>
                    <TableCell className='text-center'>
                      <Button size='sm' className='h-7 px-3' onClick={() => aplicar(c)}>Seleccionar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
