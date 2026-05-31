import { useState } from 'react'
import { FileSpreadsheet, FileText, RefreshCw, ReceiptText } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props { noCia: string; punto: string }

type FacturaRnc = {
  documento: string
  fecha: string
  no_cliente_fmt: string
  vendedor: string
  nombre: string
  rnc: string
  ncf: string
  cxc_documento: string
  referencias_cxc: string
  total_neto: number
}

const PAGINA_TAM = 50
const fmtN = (n: number) => Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function RepFacturasRnc({ noCia, punto }: Props) {
  const today = new Date()
  const isoToday = today.toISOString().slice(0, 10)
  const isoMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const [desde, setDesde] = useState(() => isoMonthStart)
  const [hasta, setHasta] = useState(() => isoToday)
  const [tipoDocu, setTipoDocu] = useState('T')
  const [rnc, setRnc] = useState('')
  const [noCliente, setNoCliente] = useState('')
  const [rows, setRows] = useState<FacturaRnc[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    if (!noCia || !desde || !hasta) return
    setLoading(true)
    setError(null)
    regalGeneralApi.fatRepFacturasRnc(noCia, punto, desde, hasta, tipoDocu, rnc, noCliente)
      .then((d) => { setRows(d.items as FacturaRnc[]); setLoaded(true); setPagina(1) })
      .catch(err => { console.error('[rep-facturas-rnc] load failed', err); setError(err?.message || 'Error de red') })
      .finally(() => setLoading(false))
  }

  const periodoLabel = `${desde} / ${hasta}`
  const paginaRows = rows.slice((pagina - 1) * PAGINA_TAM, pagina * PAGINA_TAM)
  const totalNeto = rows.reduce((s, r) => s + Number(r.total_neto ?? 0), 0)

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, periodoLabel)
    downloadCsv(
      `fat-facturas-rnc-${desde}-${hasta}.csv`,
      ['Documento', 'Fecha', 'No. Cliente', 'Vendedor', 'RNC', 'Nombre', 'NCF', 'Documento CXC', 'Referencias CXC', 'Total'],
      rows.map((r) => [r.documento, r.fecha, r.no_cliente_fmt, r.vendedor, r.rnc, r.nombre, r.ncf,
                       r.cxc_documento, r.referencias_cxc, Number(r.total_neto ?? 0).toFixed(2)]),
      meta,
    )
  }

  const openPdf = () => {
    if (!desde || !hasta) return
    const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'
    const qs = new URLSearchParams({ no_cia: noCia, punto, desde, hasta, tipo_docu: tipoDocu })
    if (rnc) qs.set('rnc', rnc)
    if (noCliente) qs.set('no_cliente', noCliente)
    window.open(`${API_BASE}/fat/reportes/facturas-rnc/pdf/?${qs.toString()}`, '_blank')
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='flex items-center gap-2 text-lg font-semibold'>
            <ReceiptText className='h-5 w-5' /> Facturas con RNC
          </h2>
          <p className='text-sm text-muted-foreground'>Rfat328 - Empresa {noCia} - Punto {punto}</p>
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
          <label className='text-xs font-medium text-muted-foreground'>Tipo</label>
          <select value={tipoDocu} onChange={(e) => setTipoDocu(e.target.value)} className='h-8 rounded-md border bg-background px-2 text-sm'>
            <option value='T'>Todos</option>
            <option value='F'>Factura credito</option>
            <option value='O'>Factura contado</option>
          </select>
        </div>
        <div className='flex flex-col gap-1'>
          <label className='text-xs font-medium text-muted-foreground'>RNC</label>
          <Input value={rnc} onChange={(e) => setRnc(e.target.value)} className='h-8 w-36' placeholder='Opcional' />
        </div>
        <div className='flex flex-col gap-1'>
          <label className='text-xs font-medium text-muted-foreground'>Cliente</label>
          <Input value={noCliente} onChange={(e) => setNoCliente(e.target.value)} className='h-8 w-28' placeholder='No.' />
        </div>
        <Button size='sm' onClick={load} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Cargando...' : 'Generar'}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-32'>Documento</TableHead>
            <TableHead className='w-24'>Fecha</TableHead>
            <TableHead className='w-24'>Cliente</TableHead>
            <TableHead className='w-32'>RNC</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead className='w-32'>NCF</TableHead>
            <TableHead className='w-36'>Ref. CXC</TableHead>
            <TableHead className='w-28 text-right'>Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
          {!loading && !loaded && <TableRow><TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>Seleccione filtros y presione Generar.</TableCell></TableRow>}
          {!loading && loaded && rows.length === 0 && <TableRow><TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>Sin facturas para este periodo.</TableCell></TableRow>}
          {paginaRows.map((row) => (
            <TableRow key={row.documento}>
              <TableCell className='font-mono text-xs'>{row.documento}</TableCell>
              <TableCell className='text-sm'>{row.fecha}</TableCell>
              <TableCell className='font-mono text-xs'>{row.no_cliente_fmt}</TableCell>
              <TableCell className='font-mono text-xs'>{row.rnc}</TableCell>
              <TableCell className='text-sm'>{row.nombre}</TableCell>
              <TableCell className='font-mono text-xs'>{row.ncf}</TableCell>
              <TableCell className='text-xs'>{row.referencias_cxc || row.cxc_documento}</TableCell>
              <TableCell className='text-right font-mono'>{fmtN(row.total_neto)}</TableCell>
            </TableRow>
          ))}
          {rows.length > 0 && (
            <TableRow className='border-t-2 bg-muted/40 font-semibold'>
              <TableCell colSpan={7} className='text-right'>TOTAL ({rows.length} registros)</TableCell>
              <TableCell className='text-right font-mono'>{fmtN(totalNeto)}</TableCell>
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
