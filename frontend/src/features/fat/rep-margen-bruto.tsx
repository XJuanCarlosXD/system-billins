import { useState } from 'react'
import { FileSpreadsheet, FileText, RefreshCw, TrendingUp } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props { noCia: string; punto: string }

type MargenRow = {
  clave: string
  descripcion: string
  cantidad: number
  facturas: number
  lineas: number
  venta: number
  costo: number
  beneficio: number
  margen_pct: number
}

const PAGINA_TAM = 50
const fmtN = (n: number) => Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function RepMargenBruto({ noCia, punto }: Props) {
  const today = new Date()
  const isoToday = today.toISOString().slice(0, 10)
  const isoMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const [desde, setDesde] = useState(() => isoMonthStart)
  const [hasta, setHasta] = useState(() => isoToday)
  const [agrupar, setAgrupar] = useState('producto')
  const [tipoDocu, setTipoDocu] = useState('T')
  const [vendedor, setVendedor] = useState('')
  const [almacen, setAlmacen] = useState('')
  const [noCliente, setNoCliente] = useState('')
  const [noProdu, setNoProdu] = useState('')
  const [rows, setRows] = useState<MargenRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    if (!noCia || !desde || !hasta) return
    setLoading(true)
    setError(null)
    regalGeneralApi.fatRepMargenBruto(noCia, punto, desde, hasta, agrupar, tipoDocu, vendedor, almacen, noCliente, noProdu)
      .then((d) => { setRows(d.items as MargenRow[]); setLoaded(true); setPagina(1) })
      .catch(err => { console.error('[rep-margen-bruto] load failed', err); setError(err?.message || 'Error de red') })
      .finally(() => setLoading(false))
  }

  const paginaRows = rows.slice((pagina - 1) * PAGINA_TAM, pagina * PAGINA_TAM)
  const totalVenta = rows.reduce((s, r) => s + Number(r.venta ?? 0), 0)
  const totalCosto = rows.reduce((s, r) => s + Number(r.costo ?? 0), 0)
  const totalBeneficio = rows.reduce((s, r) => s + Number(r.beneficio ?? 0), 0)
  const totalMargen = totalVenta ? (totalBeneficio / totalVenta) * 100 : 0
  const periodoLabel = `${desde} / ${hasta}`

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, periodoLabel)
    downloadCsv(
      `fat-margen-bruto-${agrupar}-${desde}-${hasta}.csv`,
      ['Clave', 'Descripcion', 'Cantidad', 'Facturas', 'Lineas', 'Venta', 'Costo', 'Beneficio', 'Margen %'],
      rows.map((r) => [r.clave, r.descripcion, Number(r.cantidad ?? 0).toFixed(2), r.facturas, r.lineas,
                       Number(r.venta ?? 0).toFixed(2), Number(r.costo ?? 0).toFixed(2),
                       Number(r.beneficio ?? 0).toFixed(2), Number(r.margen_pct ?? 0).toFixed(2)]),
      meta,
    )
  }

  const openPdf = () => {
    if (!desde || !hasta) return
    const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'
    const qs = new URLSearchParams({ no_cia: noCia, punto, desde, hasta, agrupar, tipo_docu: tipoDocu })
    if (vendedor) qs.set('vendedor', vendedor)
    if (almacen) qs.set('almacen', almacen)
    if (noCliente) qs.set('no_cliente', noCliente)
    if (noProdu) qs.set('no_produ', noProdu)
    window.open(`${API_BASE}/fat/reportes/margen-bruto/pdf/?${qs.toString()}`, '_blank')
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='flex items-center gap-2 text-lg font-semibold'>
            <TrendingUp className='h-5 w-5' /> Margen de Beneficio Bruto
          </h2>
          <p className='text-sm text-muted-foreground'>Rfat302 / Ffat311 - Empresa {noCia} - Punto {punto}</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={openPdf} disabled={!loaded}><FileText className='mr-1 h-4 w-4' /> Imprimir PDF</Button>
          <Button variant='outline' size='sm' onClick={exportCsv} disabled={!loaded}><FileSpreadsheet className='mr-1 h-4 w-4' /> Excel</Button>
        </div>
      </div>

      {error && <div className='text-sm text-destructive'>{error}</div>}

      <div className='flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3'>
        <div className='flex flex-col gap-1'>
          <label className='text-xs font-medium text-muted-foreground'>Desde</label>
          <Input type='date' value={desde} onChange={(e) => setDesde(e.target.value)} className='h-8 w-36' />
        </div>
        <div className='flex flex-col gap-1'>
          <label className='text-xs font-medium text-muted-foreground'>Hasta</label>
          <Input type='date' value={hasta} onChange={(e) => setHasta(e.target.value)} className='h-8 w-36' />
        </div>
        <div className='flex flex-col gap-1'>
          <label className='text-xs font-medium text-muted-foreground'>Agrupar</label>
          <select value={agrupar} onChange={(e) => setAgrupar(e.target.value)} className='h-8 rounded-md border bg-background px-2 text-sm'>
            <option value='producto'>Producto</option>
            <option value='cliente'>Cliente</option>
            <option value='factura'>Factura</option>
          </select>
        </div>
        <div className='flex flex-col gap-1'>
          <label className='text-xs font-medium text-muted-foreground'>Tipo</label>
          <select value={tipoDocu} onChange={(e) => setTipoDocu(e.target.value)} className='h-8 rounded-md border bg-background px-2 text-sm'>
            <option value='T'>Todos</option>
            <option value='F'>Factura credito</option>
            <option value='O'>Factura contado</option>
          </select>
        </div>
        <div className='flex flex-col gap-1'>
          <label className='text-xs font-medium text-muted-foreground'>Almacen</label>
          <Input value={almacen} onChange={(e) => setAlmacen(e.target.value)} className='h-8 w-24' placeholder='Todos' />
        </div>
        <div className='flex flex-col gap-1'>
          <label className='text-xs font-medium text-muted-foreground'>Vendedor</label>
          <Input value={vendedor} onChange={(e) => setVendedor(e.target.value)} className='h-8 w-28' placeholder='Todos' />
        </div>
        <div className='flex flex-col gap-1'>
          <label className='text-xs font-medium text-muted-foreground'>Cliente</label>
          <Input value={noCliente} onChange={(e) => setNoCliente(e.target.value)} className='h-8 w-28' placeholder='No.' />
        </div>
        <div className='flex flex-col gap-1'>
          <label className='text-xs font-medium text-muted-foreground'>Producto</label>
          <Input value={noProdu} onChange={(e) => setNoProdu(e.target.value)} className='h-8 w-32' placeholder='Codigo' />
        </div>
        <Button size='sm' onClick={load} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Cargando...' : 'Generar'}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-32'>Clave</TableHead>
            <TableHead>Descripcion</TableHead>
            <TableHead className='w-24 text-right'>Cantidad</TableHead>
            <TableHead className='w-20 text-right'>Fact.</TableHead>
            <TableHead className='w-28 text-right'>Venta</TableHead>
            <TableHead className='w-28 text-right'>Costo</TableHead>
            <TableHead className='w-28 text-right'>Beneficio</TableHead>
            <TableHead className='w-24 text-right'>Margen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
          {!loading && !loaded && <TableRow><TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>Seleccione filtros y presione Generar.</TableCell></TableRow>}
          {!loading && loaded && rows.length === 0 && <TableRow><TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>Sin ventas para este periodo.</TableCell></TableRow>}
          {paginaRows.map((row) => (
            <TableRow key={row.clave}>
              <TableCell className='font-mono text-xs'>{row.clave}</TableCell>
              <TableCell className='text-sm'>{row.descripcion}</TableCell>
              <TableCell className='text-right font-mono'>{fmtN(row.cantidad)}</TableCell>
              <TableCell className='text-right font-mono'>{row.facturas}</TableCell>
              <TableCell className='text-right font-mono'>{fmtN(row.venta)}</TableCell>
              <TableCell className='text-right font-mono'>{fmtN(row.costo)}</TableCell>
              <TableCell className='text-right font-mono font-semibold'>{fmtN(row.beneficio)}</TableCell>
              <TableCell className='text-right font-mono'>{fmtN(row.margen_pct)}%</TableCell>
            </TableRow>
          ))}
          {rows.length > 0 && (
            <TableRow className='border-t-2 bg-muted/40 font-semibold'>
              <TableCell colSpan={4} className='text-right'>TOTAL ({rows.length} registros)</TableCell>
              <TableCell className='text-right font-mono'>{fmtN(totalVenta)}</TableCell>
              <TableCell className='text-right font-mono'>{fmtN(totalCosto)}</TableCell>
              <TableCell className='text-right font-mono'>{fmtN(totalBeneficio)}</TableCell>
              <TableCell className='text-right font-mono'>{fmtN(totalMargen)}%</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {loaded && rows.length > PAGINA_TAM && (
        <div className='mt-2 flex items-center justify-between text-sm'>
          <span>Mostrando {(pagina - 1) * PAGINA_TAM + 1} - {Math.min(pagina * PAGINA_TAM, rows.length)} de {rows.length}</span>
          <div className='flex items-center gap-2'>
            <Button size='sm' variant='outline' disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>Anterior</Button>
            <span>Pagina {pagina} de {Math.max(1, Math.ceil(rows.length / PAGINA_TAM))}</span>
            <Button size='sm' variant='outline' disabled={pagina >= Math.ceil(rows.length / PAGINA_TAM)} onClick={() => setPagina(p => p + 1)}>Siguiente</Button>
          </div>
        </div>
      )}
    </section>
  )
}
