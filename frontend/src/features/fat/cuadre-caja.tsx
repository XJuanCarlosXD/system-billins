import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calculator, FileSpreadsheet, Printer, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props { noCia: string; punto: string }

type ResumenItem = { tipo_pago: string; forma_pago: string; cantidad: number; total: number }
type HistorialItem = { no_cuadre_caja: number; fecha: string | null; usuario: string; total_monto: number }

const API = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

const fmtN = (n: number) =>
  Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d: any) => d ? String(d).slice(0, 10) : '—'

async function fetchCuadre(noCia: string, punto: string, desde: string, hasta: string, tipo: string, noCuadre = '') {
  const p = new URLSearchParams({ no_cia: noCia, punto })
  if (desde) p.set('desde', desde)
  if (hasta) p.set('hasta', hasta)
  if (tipo) p.set('tipo', tipo)
  if (noCuadre) p.set('no_cuadre', noCuadre)
  const res = await fetch(`${API}/fat/cuadre-caja/?${p}`, { credentials: 'include' })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{ resumen: ResumenItem[]; historial: HistorialItem[] }>
}

export function CuadreCajaFat({ noCia, punto }: Props) {
  const [filterDesde, setFilterDesde] = useState('')
  const [filterHasta, setFilterHasta] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [aplicados, setAplicados] = useState({ desde: '', hasta: '', tipo: '' })
  // Drill-down key is the fecha (YYYY-MM-DD) of the selected row
  const [selectedFecha, setSelectedFecha] = useState<string | null>(null)

  const historialQ = useQuery({
    queryKey: ['fat-cuadre-historial', noCia, punto, aplicados.desde, aplicados.hasta, aplicados.tipo],
    queryFn: () => fetchCuadre(noCia, punto, aplicados.desde, aplicados.hasta, aplicados.tipo),
    enabled: !!noCia,
    staleTime: 60_000,
    select: (d) => d.historial,
  })

  // Detail: filter by the selected date (desde=fecha&hasta=fecha)
  const detalleQ = useQuery({
    queryKey: ['fat-cuadre-detalle', noCia, punto, selectedFecha, aplicados.tipo],
    queryFn: () => fetchCuadre(noCia, punto, selectedFecha!, selectedFecha!, aplicados.tipo, ''),
    enabled: !!noCia && selectedFecha !== null,
    staleTime: 60_000,
    select: (d) => d.resumen,
  })

  const historial = historialQ.data ?? []
  const detalle = detalleQ.data ?? []
  const selected = historial.find((h) => h.fecha === selectedFecha) ?? null
  const grandTotal = detalle.reduce((s, r) => s + (r.total ?? 0), 0)

  const applyFilters = () => {
    setSelectedFecha(null)
    setAplicados({ desde: filterDesde, hasta: filterHasta, tipo: filterTipo })
  }

  const mesAno = (() => {
    const now = new Date()
    return `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`
  })()

  const exportCsv = async () => {
    if (!detalle.length) return
    const meta = await buildReportMeta(noCia, punto, mesAno)
    downloadCsv(
      `cuadre-caja-${selectedFecha ?? 'general'}.csv`,
      ['Tipo Pago', 'Descripcion', 'Cantidad', 'Total RD'],
      detalle.map((r) => [r.tipo_pago, r.forma_pago, r.cantidad, Number(r.total ?? 0).toFixed(2)]),
      meta,
    )
  }

  const exportPdf = async () => {
    if (!detalle.length) return
    const meta = await buildReportMeta(noCia, punto, mesAno)
    const fecha = new Date().toLocaleDateString('es-DO')
    const rows = detalle.map((r) =>
      `<tr><td>${r.tipo_pago}</td><td>${r.forma_pago}</td>` +
      `<td class="r">${r.cantidad}</td><td class="r">${fmtN(r.total)}</td></tr>`
    ).join('')
    const cuadreNo = selected?.no_cuadre_caja ? `Cuadre No. ${selected.no_cuadre_caja} &mdash; ` : ''
    const titulo = `${cuadreNo}${fmtDate(selectedFecha)}`
    const win = window.open('', '_blank')!
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>
    <title>Cuadre de Caja</title>
    <style>
    body{font-family:Arial,sans-serif;font-size:9pt;padding:20px;color:#000}
    .rh{display:flex;justify-content:space-between;margin-bottom:8px}
    .co{font-size:12pt;font-weight:bold}.sub{font-size:8pt;color:#555;margin:2px 0}
    .sep{border:none;border-top:2px solid #000;margin:6px 0}
    table{width:100%;border-collapse:collapse;font-size:8pt;margin-top:8px}
    th,td{border:1px solid #333;padding:3px 6px}th{background:#e8e8e8;font-weight:bold}
    .r{text-align:right}.total-row{font-weight:bold;background:#f0f0f0}
    @page{size:letter portrait;margin:1.5cm}
    @media print{body{margin:0;-webkit-print-color-adjust:exact}}
    </style></head><body>
    <div class="rh">
      <div>
        <div class="co">${meta.company}</div>
        ${meta.rnc ? `<div class="sub">RNC ${meta.rnc}</div>` : ''}
        <div class="sub">Cuadre de Caja &mdash; ${punto}</div>
        <div class="sub">${titulo}</div>
      </div>
      <div style="text-align:right;font-size:8pt">
        <div style="font-size:10pt;font-weight:bold">FFAT</div>
        <div>${fecha}</div>
        <div>${mesAno}</div>
      </div>
    </div>
    <hr class="sep"/>
    <table>
      <thead><tr><th>Tipo</th><th>Descripcion</th><th class="r">Cant.</th><th class="r">Total RD</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="3" class="total-row r"><b>TOTAL</b></td>
      <td class="r total-row"><b>${fmtN(grandTotal)}</b></td></tr></tfoot>
    </table>
    </body></html>`)
    win.document.close(); win.print()
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <Calculator className='h-5 w-5' /> Cuadre de Caja
          </h2>
          <p className='text-sm text-muted-foreground'>Empresa {noCia} / Punto {punto}</p>
        </div>
        <div className='flex gap-2 flex-wrap'>
          <Button variant='outline' size='sm' onClick={exportPdf} disabled={!detalle.length}>
            <Printer className='mr-1 h-4 w-4' /> PDF
          </Button>
          <Button variant='outline' size='sm' onClick={exportCsv} disabled={!detalle.length}>
            <FileSpreadsheet className='mr-1 h-4 w-4' /> Excel
          </Button>
          <Button variant='outline' size='sm' onClick={() => historialQ.refetch()}>
            <RefreshCw className='mr-1 h-4 w-4' /> Actualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className='flex gap-2 flex-wrap items-end'>
        <div className='space-y-1'>
          <label className='text-xs text-muted-foreground'>Desde</label>
          <Input type='date' value={filterDesde} onChange={(e) => setFilterDesde(e.target.value)} className='h-8 w-36' />
        </div>
        <div className='space-y-1'>
          <label className='text-xs text-muted-foreground'>Hasta</label>
          <Input type='date' value={filterHasta} onChange={(e) => setFilterHasta(e.target.value)} className='h-8 w-36' />
        </div>
        <div className='space-y-1'>
          <label className='text-xs text-muted-foreground'>Tipo doc.</label>
          <Input value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className='h-8 w-24' placeholder='Ej. 01' />
        </div>
        <Button size='sm' className='h-8' onClick={applyFilters}>Filtrar</Button>
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-3'>
        {/* Historial por fecha */}
        <div className='lg:col-span-1'>
          <h3 className='text-sm font-semibold mb-2'>Historial por Fecha</h3>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead className='text-right'>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historialQ.isLoading && (
                  <TableRow><TableCell colSpan={3} className='py-6 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>
                )}
                {!historialQ.isLoading && historial.length === 0 && (
                  <TableRow><TableCell colSpan={3} className='py-6 text-center text-muted-foreground'>Sin movimientos en este rango.</TableCell></TableRow>
                )}
                {historial.map((h) => (
                  <TableRow
                    key={h.fecha ?? h.no_cuadre_caja}
                    className={`cursor-pointer hover:bg-blue-50 ${selectedFecha === h.fecha ? 'bg-blue-100 font-medium' : ''}`}
                    onClick={() => setSelectedFecha(h.fecha ?? null)}
                  >
                    <TableCell className='text-sm font-semibold'>{fmtDate(h.fecha)}</TableCell>
                    <TableCell className='text-sm'>{h.usuario}</TableCell>
                    <TableCell className='text-right font-mono text-sm'>{fmtN(h.total_monto)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Detalle del día seleccionado */}
        <div className='lg:col-span-2'>
          <h3 className='text-sm font-semibold mb-2'>
            {selected
              ? `Detalle — ${fmtDate(selected.fecha)}${selected.no_cuadre_caja ? ` · Cuadre #${selected.no_cuadre_caja}` : ''} · ${selected.usuario}`
              : 'Seleccione una fecha'}
          </h3>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-20'>Tipo</TableHead>
                  <TableHead>Descripcion</TableHead>
                  <TableHead className='w-20 text-right'>Cant.</TableHead>
                  <TableHead className='w-32 text-right'>Total RD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalleQ.isLoading && (
                  <TableRow><TableCell colSpan={4} className='py-6 text-center text-muted-foreground'>Cargando detalle...</TableCell></TableRow>
                )}
                {!detalleQ.isLoading && selectedFecha === null && (
                  <TableRow><TableCell colSpan={4} className='py-10 text-center text-muted-foreground'>Haga clic en una fecha para ver el detalle.</TableCell></TableRow>
                )}
                {!detalleQ.isLoading && selectedFecha !== null && detalle.length === 0 && (
                  <TableRow><TableCell colSpan={4} className='py-6 text-center text-muted-foreground'>Sin movimientos registrados.</TableCell></TableRow>
                )}
                {detalle.map((r) => (
                  <TableRow key={r.tipo_pago}>
                    <TableCell className='font-mono'>{r.tipo_pago}</TableCell>
                    <TableCell>{r.forma_pago}</TableCell>
                    <TableCell className='text-right font-mono'>{r.cantidad}</TableCell>
                    <TableCell className='text-right font-mono'>{fmtN(r.total)}</TableCell>
                  </TableRow>
                ))}
                {detalle.length > 0 && (
                  <TableRow className='border-t-2 bg-muted/40 font-semibold'>
                    <TableCell colSpan={3} className='text-right'>TOTAL</TableCell>
                    <TableCell className='text-right font-mono'>{fmtN(grandTotal)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </section>
  )
}
