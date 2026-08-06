import { useState } from 'react'
import { FileSpreadsheet, FileText, Printer, XCircle, RefreshCw } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props { noCia: string; punto: string }

type NcfNulo = {
  ncf: string; tipo_ncf: string; fecha_desde: string; fecha_hasta: string
  motivo_anulacion: string; fecha_anulacion: string; no_factura: string
}

const fmtDate = (d: any) => d ? String(d).slice(0, 10) : '—'

const PAGINA_TAM = 50

export function RepNcfNulos({ noCia, punto }: Props) {
  const today = new Date()
  const isoToday = today.toISOString().slice(0, 10)
  const isoMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const [desde, setDesde] = useState(() => isoMonthStart)
  const [hasta, setHasta] = useState(() => isoToday)
  const [rows, setRows] = useState<NcfNulo[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    if (!noCia || !desde || !hasta) return
    setLoading(true)
    setError(null)
    regalGeneralApi.fatRepNcfNulos(noCia, punto, desde, hasta)
      .then((d) => { setRows(d.items as NcfNulo[]); setLoaded(true); setPagina(1) })
      .catch(err => { console.error('[rep-ncf-nulos] load failed', err); setError(err?.message || 'Error de red') })
      .finally(() => setLoading(false))
  }

  const periodoLabel = `${desde} / ${hasta}`

  const paginaRows = rows.slice((pagina - 1) * PAGINA_TAM, pagina * PAGINA_TAM)

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, periodoLabel)
    downloadCsv(
      `fat-ncf-nulos-${desde}-${hasta}.csv`,
      ['NCF', 'Tipo NCF', 'Fecha Desde', 'Fecha Hasta', 'Motivo', 'Fecha Anulación', 'No. Factura'],
      rows.map((r) => [r.ncf, r.tipo_ncf, fmtDate(r.fecha_desde), fmtDate(r.fecha_hasta),
                       r.motivo_anulacion, fmtDate(r.fecha_anulacion), r.no_factura || '']),
      meta,
    )
  }

  const exportPdf = async () => {
    const meta = await buildReportMeta(noCia, punto, periodoLabel)
    const win = window.open('', '_blank')!
    win.document.write(`<html><head><title>NCF Nulos / Anulados</title>
    <style>body{font-family:Arial,sans-serif;font-size:9px;padding:15px}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:2px 5px}
    th{background:#ddd;font-weight:bold}.hdr{margin-bottom:10px}h3{margin:0;font-size:13px}
    .sub{color:#666}</style></head><body>
    <div class="hdr"><h3>${meta.empresa}</h3>
    <div class="sub">NCF Nulos / Anulados · ${periodoLabel}</div>
    <div class="sub">Generado: ${meta.fecha}</div></div>
    <table><thead><tr><th>NCF</th><th>Tipo</th><th>Fecha Desde</th><th>Fecha Hasta</th>
    <th>Motivo</th><th>Fecha Anulación</th><th>Factura</th></tr></thead>
    <tbody>${rows.map((r) => `<tr>
    <td>${r.ncf}</td><td>${r.tipo_ncf}</td><td>${fmtDate(r.fecha_desde)}</td><td>${fmtDate(r.fecha_hasta)}</td>
    <td>${r.motivo_anulacion}</td><td>${fmtDate(r.fecha_anulacion)}</td><td>${r.no_factura || ''}</td></tr>`).join('')}
    </tbody></table></body></html>`)
    win.document.close(); win.print()
  }

  const openListadoPdf = () => {
    if (!desde || !hasta) return
    const qs = new URLSearchParams({ no_cia: noCia, punto, desde, hasta }).toString()
    window.open(`/print/fat-ncf-nulos/x?${qs}`, '_blank')
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <XCircle className='h-5 w-5' /> NCF Nulos / Anulados
          </h2>
          <p className='text-sm text-muted-foreground'>RFAT — Comprobantes anulados · Empresa {noCia} · Punto {punto}</p>
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
            <TableHead className='w-32'>NCF</TableHead>
            <TableHead className='w-20 text-center'>Tipo</TableHead>
            <TableHead className='w-24'>Fecha Desde</TableHead>
            <TableHead className='w-24'>Fecha Hasta</TableHead>
            <TableHead>Motivo Anulación</TableHead>
            <TableHead className='w-28'>Fecha Anulación</TableHead>
            <TableHead className='w-24'>Factura</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
          {!loading && !loaded && <TableRow><TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>Seleccione el rango de fechas y presione Generar.</TableCell></TableRow>}
          {!loading && loaded && rows.length === 0 && <TableRow><TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>Sin NCF nulos en este período.</TableCell></TableRow>}
          {paginaRows.map((row, i) => (
            <TableRow key={`${row.ncf}-${i}`}>
              <TableCell className='font-mono text-xs'>{row.ncf}</TableCell>
              <TableCell className='text-center'>
                <Badge variant='outline' className='text-xs'>{row.tipo_ncf}</Badge>
              </TableCell>
              <TableCell className='text-sm'>{fmtDate(row.fecha_desde)}</TableCell>
              <TableCell className='text-sm'>{fmtDate(row.fecha_hasta)}</TableCell>
              <TableCell className='text-sm'>{row.motivo_anulacion}</TableCell>
              <TableCell className='text-sm text-destructive'>{fmtDate(row.fecha_anulacion)}</TableCell>
              <TableCell className='font-mono text-sm'>{row.no_factura || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {loaded && rows.length > 0 && (
        <p className='text-sm text-muted-foreground'>{rows.length} comprobante{rows.length !== 1 ? 's' : ''} anulado{rows.length !== 1 ? 's' : ''} en este período.</p>
      )}

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
