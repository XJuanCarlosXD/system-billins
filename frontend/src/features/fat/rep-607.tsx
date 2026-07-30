import { useState } from 'react'
import { FileSpreadsheet, FileText, Printer, ShieldCheck, RefreshCw } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props { noCia: string; punto: string }

type Ncf607 = {
  ncf: number; codigo_ncf: string; tipo_ncf_fiscal: string
  posiciones_fijas_ncf: string; ncf_dgi: string
  no_factura: string; tipo_factura: string; fecha: string
  rnc: string; nombre_cliente: string
  total_neto: number; impuesto: number; total_linea: number
}

// NCF DGI real: prefijo (posiciones_fijas_ncf, ej. B01/B02/E31) + numero con
// padding. codigo_ncf/tipo_ncf_fiscal son campos legacy casi siempre vacios
// -- no usar para mostrar el comprobante ni el tipo al usuario.
function ncfDgiDe(r: Ncf607): string {
  if (r.ncf_dgi) return r.ncf_dgi
  const p = (r.posiciones_fijas_ncf || '').trim().toUpperCase()
  if (!p || !r.ncf) return r.ncf ? String(r.ncf) : ''
  const width = p.startsWith('E') ? 10 : 8
  return `${p}${String(r.ncf).padStart(width, '0')}`
}

const PAGINA_TAM = 50

export function RepNcf607({ noCia, punto }: Props) {
  const today = new Date()
  const isoToday = today.toISOString().slice(0, 10)
  const isoMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const [desde, setDesde] = useState(() => isoMonthStart)
  const [hasta, setHasta] = useState(() => isoToday)
  const [rows, setRows] = useState<Ncf607[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    if (!noCia || !desde || !hasta) return
    setLoading(true)
    setError(null)
    regalGeneralApi.fatRep607(noCia, punto, desde, hasta)
      .then((d) => { setRows(d.items as Ncf607[]); setLoaded(true); setPagina(1) })
      .catch(err => { console.error('[rep-607] load failed', err); setError(err?.message || 'Error de red') })
      .finally(() => setLoading(false))
  }

  const totalNeto = rows.reduce((s, r) => s + (r.total_neto ?? 0), 0)
  const totalItbis = rows.reduce((s, r) => s + (r.impuesto ?? 0), 0)
  const totalLinea = rows.reduce((s, r) => s + (r.total_linea ?? 0), 0)

  const periodoLabel = `${desde} / ${hasta}`

  const fmtN = (n: number) => Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const paginaRows = rows.slice((pagina - 1) * PAGINA_TAM, pagina * PAGINA_TAM)

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, periodoLabel)
    downloadCsv(
      `fat-ncf-607-${desde}-${hasta}.csv`,
      ['NCF', 'Tipo NCF', 'No. Factura', 'Tipo', 'Fecha', 'RNC', 'Cliente', 'Total Neto', 'ITBIS', 'Total Línea'],
      rows.map((r) => [ncfDgiDe(r), r.posiciones_fijas_ncf, r.no_factura, r.tipo_factura,
                       r.fecha, r.rnc, r.nombre_cliente,
                       Number(r.total_neto ?? 0).toFixed(2), Number(r.impuesto ?? 0).toFixed(2),
                       Number(r.total_linea ?? 0).toFixed(2)]),
      meta,
    )
  }

  const openListadoPdf = () => {
    if (!desde || !hasta) return
    const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'
    const qs = new URLSearchParams({ no_cia: noCia, punto, desde, hasta }).toString()
    window.open(`${API_BASE}/fat/reportes/607/pdf/?${qs}`, '_blank')
  }

  const exportPdf = async () => {
    const meta = await buildReportMeta(noCia, punto, periodoLabel)
    const win = window.open('', '_blank')!
    win.document.write(`<html><head><title>NCF 607 - ${desde} a ${hasta}</title>
    <style>body{font-family:Arial,sans-serif;font-size:8px;padding:15px}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:2px 4px}
    th{background:#ddd;font-weight:bold;text-align:left}.hdr{margin-bottom:10px}
    h3{margin:0;font-size:13px}.sub{color:#666}.r{text-align:right}
    .total{font-weight:bold;background:#f0f0f0}</style></head><body>
    <div class="hdr"><h3>${meta.empresa}</h3>
    <div class="sub">NCF Formato 607 · ${periodoLabel}</div>
    <div class="sub">Generado: ${meta.fecha}</div></div>
    <table><thead><tr><th>NCF</th><th>Tipo</th><th>Factura</th><th>T.Fact.</th>
    <th>Fecha</th><th>RNC</th><th>Cliente</th><th class="r">Total Neto</th><th class="r">ITBIS</th><th class="r">Total Línea</th></tr></thead>
    <tbody>${rows.map((r) => `<tr>
    <td>${ncfDgiDe(r)}</td><td>${r.posiciones_fijas_ncf || ''}</td>
    <td>${r.no_factura}</td><td>${r.tipo_factura}</td><td>${r.fecha}</td>
    <td>${r.rnc}</td><td>${r.nombre_cliente}</td>
    <td class="r">${Number(r.total_neto ?? 0).toFixed(2)}</td>
    <td class="r">${Number(r.impuesto ?? 0).toFixed(2)}</td>
    <td class="r">${Number(r.total_linea ?? 0).toFixed(2)}</td></tr>`).join('')}
    <tr class="total"><td colspan="7"><b>TOTALES — ${rows.length} registros</b></td>
    <td class="r"><b>${totalNeto.toFixed(2)}</b></td>
    <td class="r"><b>${totalItbis.toFixed(2)}</b></td>
    <td class="r"><b>${totalLinea.toFixed(2)}</b></td></tr>
    </tbody></table></body></html>`)
    win.document.close(); win.print()
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <ShieldCheck className='h-5 w-5' /> NCF Formato 607
          </h2>
          <p className='text-sm text-muted-foreground'>RFAT — Comprobantes Fiscales Emitidos · Empresa {noCia} · Punto {punto}</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={exportPdf} disabled={!loaded}><Printer className='mr-1 h-4 w-4' /> PDF</Button>
          <Button variant='outline' size='sm' onClick={openListadoPdf} disabled={!loaded}><FileText className='mr-1 h-4 w-4' /> Imprimir PDF</Button>
          <Button variant='outline' size='sm' onClick={exportCsv} disabled={!loaded}><FileSpreadsheet className='mr-1 h-4 w-4' /> Excel</Button>
        </div>
      </div>

      {error && <div className="text-destructive text-sm">{error}</div>}

      {/* Filtros de fecha */}
      <div className='flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3'>
        <div className='flex flex-col gap-1'>
          <label className='text-xs font-medium text-muted-foreground'>Desde</label>
          <Input type='date' value={desde} onChange={(e) => setDesde(e.target.value)} className='h-8 w-36' />
        </div>
        <div className='flex flex-col gap-1'>
          <label className='text-xs font-medium text-muted-foreground'>Hasta</label>
          <Input type='date' value={hasta} onChange={(e) => setHasta(e.target.value)} className='h-8 w-36' />
        </div>
        <Button size='sm' onClick={load} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Cargando...' : 'Generar'}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-28'>NCF</TableHead>
            <TableHead className='w-20 text-center'>Tipo NCF</TableHead>
            <TableHead className='w-24'>No. Factura</TableHead>
            <TableHead className='w-20'>Tipo</TableHead>
            <TableHead className='w-24'>Fecha</TableHead>
            <TableHead className='w-24'>RNC</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className='w-24 text-right'>Total Neto</TableHead>
            <TableHead className='w-24 text-right'>ITBIS</TableHead>
            <TableHead className='w-24 text-right'>Total Línea</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={10} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
          {!loading && !loaded && <TableRow><TableCell colSpan={10} className='py-10 text-center text-muted-foreground'>Seleccione el rango de fechas y presione Generar.</TableCell></TableRow>}
          {!loading && loaded && rows.length === 0 && <TableRow><TableCell colSpan={10} className='py-10 text-center text-muted-foreground'>Sin comprobantes en este período.</TableCell></TableRow>}
          {paginaRows.map((row, i) => (
            <TableRow key={`${row.ncf}-${i}`}>
              <TableCell className='font-mono text-xs'>{ncfDgiDe(row)}</TableCell>
              <TableCell className='text-center font-mono text-xs'>{row.posiciones_fijas_ncf || '—'}</TableCell>
              <TableCell className='font-mono text-xs'>{row.no_factura}</TableCell>
              <TableCell className='font-mono text-xs'>{row.tipo_factura}</TableCell>
              <TableCell className='text-xs'>{row.fecha}</TableCell>
              <TableCell className='font-mono text-xs'>{row.rnc}</TableCell>
              <TableCell className='text-xs'>{row.nombre_cliente}</TableCell>
              <TableCell className='text-right font-mono text-xs font-semibold'>{fmtN(row.total_neto)}</TableCell>
              <TableCell className='text-right font-mono text-xs'>{fmtN(row.impuesto)}</TableCell>
              <TableCell className='text-right font-mono text-xs'>{fmtN(row.total_linea ?? 0)}</TableCell>
            </TableRow>
          ))}
          {rows.length > 0 && (
            <TableRow className='border-t-2 font-semibold bg-muted/40'>
              <TableCell colSpan={7} className='text-right'>TOTALES ({rows.length} registros)</TableCell>
              <TableCell className='text-right font-mono'>{fmtN(totalNeto)}</TableCell>
              <TableCell className='text-right font-mono'>{fmtN(totalItbis)}</TableCell>
              <TableCell className='text-right font-mono'>{fmtN(totalLinea)}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {loaded && rows.length > PAGINA_TAM && (
        <div className="flex items-center justify-between mt-2 text-sm">
          <span>Mostrando {(pagina - 1) * PAGINA_TAM + 1} - {Math.min(pagina * PAGINA_TAM, rows.length)} de {rows.length}</span>
          <div className="flex gap-2 items-center">
            <Button size="sm" variant="outline" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>Anterior</Button>
            <span>Página {pagina} de {Math.max(1, Math.ceil(rows.length / PAGINA_TAM))}</span>
            <Button size="sm" variant="outline" disabled={pagina >= Math.ceil(rows.length / PAGINA_TAM)} onClick={() => setPagina(p => p + 1)}>Siguiente</Button>
          </div>
        </div>
      )}
    </section>
  )
}
