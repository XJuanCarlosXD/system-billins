import { useState } from 'react'
import { BarChart3, FileSpreadsheet, Printer, RefreshCw } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props { noCia: string; punto: string }

type VentaProducto = {
  no_produ: string; descripcion: string; cantidad: number
  monto_neto: number; impuesto: number; descuento: number
}

const fmtN = (n: number) => Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const PAGINA_TAM = 50

export function RepVentasProducto({ noCia, punto }: Props) {
  const today = new Date()
  const isoToday = today.toISOString().slice(0, 10)
  const isoMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const [desde, setDesde] = useState(() => isoMonthStart)
  const [hasta, setHasta] = useState(() => isoToday)
  const [rows, setRows] = useState<VentaProducto[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    if (!noCia || !desde || !hasta) return
    setLoading(true)
    setError(null)
    regalGeneralApi.fatRepVentas(noCia, punto, desde, hasta)
      .then((d) => { setRows(d.items as VentaProducto[]); setLoaded(true); setPagina(1) })
      .catch(err => { console.error('[rep-ventas] load failed', err); setError(err?.message || 'Error de red') })
      .finally(() => setLoading(false))
  }

  const totalNeto = rows.reduce((s, r) => s + (r.monto_neto ?? 0), 0)
  const totalItbis = rows.reduce((s, r) => s + (r.impuesto ?? 0), 0)
  const totalBruto = rows.reduce((s, r) => s + (r.monto_neto ?? 0) + (r.impuesto ?? 0), 0)

  const periodoLabel = `${desde} / ${hasta}`

  const paginaRows = rows.slice((pagina - 1) * PAGINA_TAM, pagina * PAGINA_TAM)

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, periodoLabel)
    downloadCsv(
      `fat-ventas-producto-${desde}-${hasta}.csv`,
      ['No. Producto', 'Descripción', 'Cantidad', 'Monto Neto', 'ITBIS', 'Descuento', 'Total Bruto'],
      rows.map((r) => [r.no_produ, r.descripcion, Number(r.cantidad ?? 0).toFixed(2),
                       Number(r.monto_neto ?? 0).toFixed(2), Number(r.impuesto ?? 0).toFixed(2),
                       Number(r.descuento ?? 0).toFixed(2),
                       (Number(r.monto_neto ?? 0) + Number(r.impuesto ?? 0)).toFixed(2)]),
      meta,
    )
  }

  const exportPdf = async () => {
    const meta = await buildReportMeta(noCia, punto, periodoLabel)
    const win = window.open('', '_blank')!
    win.document.write(`<html><head><title>RFAT301 - Ventas por Producto</title>
    <style>body{font-family:Arial,sans-serif;font-size:9px;padding:20px}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:2px 5px}
    th{background:#ddd;font-weight:bold;text-align:left}.hdr{margin-bottom:10px}
    h3{margin:0;font-size:13px}.sub{color:#666}.r{text-align:right}
    .total{font-weight:bold;background:#f0f0f0}</style></head><body>
    <div class="hdr"><h3>${meta.empresa}</h3>
    <div class="sub">RFAT301 · Ventas por Producto · ${periodoLabel}</div>
    <div class="sub">Generado: ${meta.fecha}</div></div>
    <table><thead><tr><th>No. Producto</th><th>Descripción</th><th class="r">Cantidad</th>
    <th class="r">Monto Neto</th><th class="r">ITBIS</th>
    <th class="r">Descuento</th><th class="r">Total Bruto</th></tr></thead>
    <tbody>${rows.map((r) => `<tr>
    <td>${r.no_produ}</td><td>${r.descripcion}</td>
    <td class="r">${Number(r.cantidad ?? 0).toFixed(2)}</td>
    <td class="r">${Number(r.monto_neto ?? 0).toFixed(2)}</td>
    <td class="r">${Number(r.impuesto ?? 0).toFixed(2)}</td>
    <td class="r">${Number(r.descuento ?? 0).toFixed(2)}</td>
    <td class="r">${(Number(r.monto_neto ?? 0) + Number(r.impuesto ?? 0)).toFixed(2)}</td></tr>`).join('')}
    <tr class="total"><td colspan="3"><b>TOTALES</b></td>
    <td class="r"><b>${totalNeto.toFixed(2)}</b></td>
    <td class="r"><b>${totalItbis.toFixed(2)}</b></td>
    <td class="r"></td>
    <td class="r"><b>${totalBruto.toFixed(2)}</b></td></tr>
    </tbody></table></body></html>`)
    win.document.close(); win.print()
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <BarChart3 className='h-5 w-5' /> Ventas por Producto
          </h2>
          <p className='text-sm text-muted-foreground'>RFAT301 — Empresa {noCia} · Punto {punto}</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={exportPdf} disabled={!loaded}><Printer className='mr-1 h-4 w-4' /> PDF</Button>
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
            <TableHead className='w-28'>No. Producto</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className='w-24 text-right'>Cantidad</TableHead>
            <TableHead className='w-28 text-right'>Monto Neto</TableHead>
            <TableHead className='w-24 text-right'>ITBIS</TableHead>
            <TableHead className='w-24 text-right'>Descuento</TableHead>
            <TableHead className='w-28 text-right'>Total Bruto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
          {!loading && !loaded && <TableRow><TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>Seleccione el rango de fechas y presione Generar.</TableCell></TableRow>}
          {!loading && loaded && rows.length === 0 && <TableRow><TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>Sin ventas para este período.</TableCell></TableRow>}
          {paginaRows.map((row) => (
            <TableRow key={row.no_produ}>
              <TableCell className='font-mono'>{row.no_produ}</TableCell>
              <TableCell className='text-sm'>{row.descripcion}</TableCell>
              <TableCell className='text-right font-mono'>{Number(row.cantidad ?? 0).toFixed(2)}</TableCell>
              <TableCell className='text-right font-mono'>{fmtN(row.monto_neto)}</TableCell>
              <TableCell className='text-right font-mono'>{fmtN(row.impuesto)}</TableCell>
              <TableCell className='text-right font-mono'>{fmtN(row.descuento)}</TableCell>
              <TableCell className='text-right font-mono font-semibold'>{fmtN((row.monto_neto ?? 0) + (row.impuesto ?? 0))}</TableCell>
            </TableRow>
          ))}
          {rows.length > 0 && (
            <TableRow className='border-t-2 font-semibold bg-muted/40'>
              <TableCell colSpan={3} className='text-right'>TOTALES ({rows.length} productos)</TableCell>
              <TableCell className='text-right font-mono'>{fmtN(totalNeto)}</TableCell>
              <TableCell className='text-right font-mono'>{fmtN(totalItbis)}</TableCell>
              <TableCell />
              <TableCell className='text-right font-mono'>{fmtN(totalBruto)}</TableCell>
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
