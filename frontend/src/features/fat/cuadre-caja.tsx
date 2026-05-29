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
type NcfItem = {
  tipo_ncf_fiscal: string; codigo_ncf: string; cantidad: number
  total_linea: number; descuento: number; impuesto: number; total_neto: number
}

const API = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

const fmtN = (n: number) =>
  Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d: any) => d ? String(d).slice(0, 10) : '—'

// Heurística simple para clasificar formas de pago como en el cuadre legado:
// Efectivo / Cheque / Tarjeta / Transferencia / Cobro Crédito (RI) / Otras.
function clasificarForma(tipo_pago: string, forma_pago: string): string {
  const t = (tipo_pago || '').toUpperCase()
  const f = (forma_pago || '').toUpperCase()
  if (t.startsWith('C')) return 'COBRO CRÉDITO'        // 'C'||forma_pago (RI cobros CXC)
  if (/EFEC|CASH|CONTAD/.test(f)) return 'EFECTIVO'
  if (/CHEQ/.test(f))             return 'CHEQUE'
  if (/TARJ|CRED.*DEB|VISA|MASTER/.test(f)) return 'TARJETA CRÉDITO/DÉBITO'
  if (/TRANS|TRF|WIRE|ACH/.test(f)) return 'TRANSFERENCIA'
  if (/BONO|CERT.*REGAL/.test(f)) return 'BONOS / CERTIFICADOS'
  if (/PERMUT/.test(f))           return 'PERMUTA'
  return 'OTRAS FORMAS DE PAGO'
}

// Etiqueta humana para B01/B02/B14/B15… si no la conocemos, devolvemos el código tal cual.
function labelNcf(tipo_ncf_fiscal: string): string {
  const t = (tipo_ncf_fiscal || '').toUpperCase()
  const map: Record<string, string> = {
    'B01': 'B01 — Crédito Fiscal',
    'B02': 'B02 — Consumo',
    'B03': 'B03 — Nota de Débito',
    'B04': 'B04 — Nota de Crédito',
    'B11': 'B11 — Proveedor Informal',
    'B12': 'B12 — Registro Único',
    'B13': 'B13 — Gastos Menores',
    'B14': 'B14 — Régimen Especial',
    'B15': 'B15 — Gubernamental',
    'B16': 'B16 — Exportación',
  }
  return map[t] || (t || '—')
}

async function fetchCuadre(noCia: string, punto: string, desde: string, hasta: string, tipo: string, noCuadre = '') {
  const p = new URLSearchParams({ no_cia: noCia, punto })
  if (desde) p.set('desde', desde)
  if (hasta) p.set('hasta', hasta)
  if (tipo) p.set('tipo', tipo)
  if (noCuadre) p.set('no_cuadre', noCuadre)
  const res = await fetch(`${API}/fat/cuadre-caja/?${p}`, { credentials: 'include' })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{ resumen: ResumenItem[]; historial: HistorialItem[]; por_ncf: NcfItem[] }>
}

export function CuadreCajaFat({ noCia, punto }: Props) {
  const [filterDesde, setFilterDesde] = useState('')
  const [filterHasta, setFilterHasta] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [aplicados, setAplicados] = useState({ desde: '', hasta: '', tipo: '' })
  const [selectedFecha, setSelectedFecha] = useState<string | null>(null)

  // Historial: trae el rango filtrado (sin restricción de fecha por día).
  const historialQ = useQuery({
    queryKey: ['fat-cuadre-historial', noCia, punto, aplicados.desde, aplicados.hasta, aplicados.tipo],
    queryFn: () => fetchCuadre(noCia, punto, aplicados.desde, aplicados.hasta, aplicados.tipo),
    enabled: !!noCia,
    staleTime: 60_000,
    select: (d) => d.historial,
  })

  // Detalle del día seleccionado: aquí pedimos resumen + por_ncf juntos.
  const detalleQ = useQuery({
    queryKey: ['fat-cuadre-detalle', noCia, punto, selectedFecha, aplicados.tipo],
    queryFn: () => fetchCuadre(noCia, punto, selectedFecha!, selectedFecha!, aplicados.tipo, ''),
    enabled: !!noCia && selectedFecha !== null,
    staleTime: 60_000,
  })

  const historial = historialQ.data ?? []
  const resumenPago: ResumenItem[] = detalleQ.data?.resumen ?? []
  const porNcf: NcfItem[] = detalleQ.data?.por_ncf ?? []
  const selected = historial.find((h) => h.fecha === selectedFecha) ?? null

  // Agrupa formas de pago al estilo legado: Efectivo, Cheque, Tarjeta, Transferencia, Cobros, Otras.
  const grupos: Array<{ clase: string; cantidad: number; total: number; items: ResumenItem[] }> = (() => {
    const m = new Map<string, { clase: string; cantidad: number; total: number; items: ResumenItem[] }>()
    for (const r of resumenPago) {
      const clase = clasificarForma(r.tipo_pago, r.forma_pago)
      const g = m.get(clase) ?? { clase, cantidad: 0, total: 0, items: [] }
      g.cantidad += r.cantidad
      g.total += r.total
      g.items.push(r)
      m.set(clase, g)
    }
    // Orden estable: efectivo primero, cobros crédito al final.
    const orden = ['EFECTIVO','CHEQUE','TARJETA CRÉDITO/DÉBITO','TRANSFERENCIA','BONOS / CERTIFICADOS','PERMUTA','OTRAS FORMAS DE PAGO','COBRO CRÉDITO']
    return Array.from(m.values()).sort((a, b) => orden.indexOf(a.clase) - orden.indexOf(b.clase))
  })()

  const totalFormaPago = grupos.reduce((s, g) => s + g.total, 0)
  const totalPorNcf = porNcf.reduce((s, r) => s + r.total_neto, 0)

  const applyFilters = () => {
    setSelectedFecha(null)
    setAplicados({ desde: filterDesde, hasta: filterHasta, tipo: filterTipo })
  }

  const mesAno = (() => {
    const now = new Date()
    return `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`
  })()

  const exportCsv = async () => {
    if (!resumenPago.length && !porNcf.length) return
    const meta = await buildReportMeta(noCia, punto, mesAno)
    // CSV combinado: primero forma de pago, después tipo NCF.
    const rows: any[][] = []
    rows.push(['=== Resumen por Forma de Pago ==='])
    rows.push(['Tipo', 'Descripcion', 'Cantidad', 'Total RD'])
    for (const g of grupos) {
      for (const it of g.items) {
        rows.push([g.clase, it.forma_pago, it.cantidad, Number(it.total ?? 0).toFixed(2)])
      }
    }
    rows.push(['', '', 'TOTAL', totalFormaPago.toFixed(2)])
    rows.push([])
    rows.push(['=== Resumen por Tipo NCF ==='])
    rows.push(['Tipo NCF', 'Codigo', 'Cantidad', 'Total Linea', 'Descuento', 'ITBIS', 'Total Neto'])
    for (const r of porNcf) {
      rows.push([r.tipo_ncf_fiscal, r.codigo_ncf, r.cantidad,
        r.total_linea.toFixed(2), r.descuento.toFixed(2),
        r.impuesto.toFixed(2), r.total_neto.toFixed(2)])
    }
    rows.push(['', '', 'TOTAL', '', '', '', totalPorNcf.toFixed(2)])
    downloadCsv(
      `cuadre-caja-${selectedFecha ?? 'general'}.csv`,
      [],  // sin header global, escribimos secciones nosotros
      rows,
      meta,
    )
  }

  // PDF estructurado tipo Rfat237 — Resumen por Forma de Pago + Resumen por Tipo NCF.
  const exportPdf = async () => {
    if (!resumenPago.length && !porNcf.length) return
    const meta = await buildReportMeta(noCia, punto, mesAno)
    const fecha = new Date().toLocaleDateString('es-DO')
    const cuadreNo = selected?.no_cuadre_caja ? `Cuadre No. ${selected.no_cuadre_caja} &mdash; ` : ''
    const titulo = `${cuadreNo}${fmtDate(selectedFecha)}`
    const usuario = selected?.usuario || ''

    // Tabla forma de pago (grupos + sus detalles indentados).
    const filasPago = grupos.map(g => {
      const head = `<tr class="grp">
        <td><b>${g.clase}</b></td><td></td>
        <td class="r"><b>${g.cantidad}</b></td>
        <td class="r"><b>${fmtN(g.total)}</b></td></tr>`
      const detalles = g.items.length > 1
        ? g.items.map(it => `<tr class="sub">
            <td></td>
            <td>${it.forma_pago}</td>
            <td class="r">${it.cantidad}</td>
            <td class="r">${fmtN(it.total)}</td></tr>`).join('')
        : ''
      return head + detalles
    }).join('')

    const filasNcf = porNcf.map(r => `<tr>
      <td>${r.tipo_ncf_fiscal || '—'}</td>
      <td>${labelNcf(r.tipo_ncf_fiscal)}${r.codigo_ncf && r.codigo_ncf !== '—' ? ` <span class="muted">(${r.codigo_ncf})</span>` : ''}</td>
      <td class="r">${r.cantidad}</td>
      <td class="r">${fmtN(r.total_linea)}</td>
      <td class="r">${fmtN(r.descuento)}</td>
      <td class="r">${fmtN(r.impuesto)}</td>
      <td class="r"><b>${fmtN(r.total_neto)}</b></td></tr>`).join('')

    const win = window.open('', '_blank')!
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>
    <title>Cuadre de Caja</title>
    <style>
    *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:9pt;color:#000;background:#fff;-webkit-print-color-adjust:exact;padding:18px}
    .rh{display:flex;justify-content:space-between;margin-bottom:6px}
    .co{font-size:12pt;font-weight:bold}.sub{font-size:8pt;color:#555;margin:2px 0}
    .sep{border:none;border-top:2px solid #000;margin:6px 0}
    h3{font-size:10pt;color:#1d4ed8;margin:14px 0 4px 0}
    table{width:100%;border-collapse:collapse;font-size:8pt;margin-top:4px}
    th,td{border:1px solid #333;padding:3px 6px;vertical-align:top}
    th{background:#e8e8e8;font-weight:bold;text-align:left}
    th.r,td.r{text-align:right;white-space:nowrap}
    tr.grp td{background:#f3f4f6}
    tr.sub td{color:#444;padding-left:14px}
    tfoot td{font-weight:bold;background:#f0f0f0}
    .muted{color:#888;font-size:7pt}
    .firmas{margin-top:60px;display:flex;justify-content:space-between;gap:80px}
    .firma{flex:1;text-align:center;border-top:1px solid #000;padding-top:4px;font-size:8pt;font-weight:bold}
    .firma .lbl{font-weight:normal;color:#555;margin-top:2px}
    @page{size:letter portrait;margin:1.5cm}
    @media print{body{margin:0}}
    </style></head><body>
    <div class="rh">
      <div>
        <div class="co">${meta.company}</div>
        ${meta.rnc ? `<div class="sub">RNC ${meta.rnc}</div>` : ''}
        <div class="sub">Sistema de Facturación &mdash; Listado Cuadre de Caja</div>
        <div class="sub">${titulo}</div>
      </div>
      <div style="text-align:right;font-size:8pt">
        <div style="font-size:10pt;font-weight:bold">Rfat237</div>
        <div>${fecha}</div>
        <div>${mesAno}</div>
      </div>
    </div>
    <hr class="sep"/>

    <h3>Resumen por Forma de Pago</h3>
    <table>
      <thead><tr>
        <th>Tipo Pago</th><th>Descripción</th>
        <th class="r">Cant.</th><th class="r">Monto RD</th>
      </tr></thead>
      <tbody>${filasPago || '<tr><td colspan="4" style="text-align:center;color:#888">Sin movimientos.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="3" class="r"><b>Total Ingresos</b></td>
        <td class="r"><b>${fmtN(totalFormaPago)}</b></td></tr></tfoot>
    </table>

    <h3>Resumen por Tipo NCF (DGII)</h3>
    <table>
      <thead><tr>
        <th>Tipo</th><th>Descripción</th>
        <th class="r">Cant.</th>
        <th class="r">Total Línea</th>
        <th class="r">Descuento</th>
        <th class="r">ITBIS</th>
        <th class="r">Total Neto</th>
      </tr></thead>
      <tbody>${filasNcf || '<tr><td colspan="7" style="text-align:center;color:#888">Sin facturas en el período.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="6" class="r"><b>TOTAL</b></td>
        <td class="r"><b>${fmtN(totalPorNcf)}</b></td></tr></tfoot>
    </table>

    <div class="firmas">
      <div class="firma">${usuario || '&nbsp;'}<div class="lbl">Cajero / Usuario</div></div>
      <div class="firma">&nbsp;<div class="lbl">Supervisor / Encargado</div></div>
    </div>

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
          <Button variant='outline' size='sm' onClick={exportPdf} disabled={!resumenPago.length && !porNcf.length}>
            <Printer className='mr-1 h-4 w-4' /> PDF
          </Button>
          <Button variant='outline' size='sm' onClick={exportCsv} disabled={!resumenPago.length && !porNcf.length}>
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
          <Input value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className='h-8 w-24' placeholder='Ej. FT' />
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

        {/* Detalle del día seleccionado: dos secciones apiladas */}
        <div className='lg:col-span-2 space-y-4'>
          <h3 className='text-sm font-semibold'>
            {selected
              ? `Detalle — ${fmtDate(selected.fecha)}${selected.no_cuadre_caja ? ` · Cuadre #${selected.no_cuadre_caja}` : ''} · ${selected.usuario}`
              : 'Seleccione una fecha'}
          </h3>

          {/* Resumen por Forma de Pago */}
          <div className='rounded-md border'>
            <div className='px-3 py-2 border-b bg-muted/40 text-sm font-semibold text-blue-700'>
              Resumen por Forma de Pago
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-44'>Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className='w-20 text-right'>Cant.</TableHead>
                  <TableHead className='w-32 text-right'>Total RD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalleQ.isLoading && (
                  <TableRow><TableCell colSpan={4} className='py-6 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>
                )}
                {!detalleQ.isLoading && selectedFecha === null && (
                  <TableRow><TableCell colSpan={4} className='py-10 text-center text-muted-foreground'>Haga clic en una fecha para ver el detalle.</TableCell></TableRow>
                )}
                {!detalleQ.isLoading && selectedFecha !== null && grupos.length === 0 && (
                  <TableRow><TableCell colSpan={4} className='py-6 text-center text-muted-foreground'>Sin movimientos.</TableCell></TableRow>
                )}
                {grupos.flatMap(g => {
                  const head = (
                    <TableRow key={`g-${g.clase}`} className='bg-blue-50/40 font-semibold'>
                      <TableCell className='font-semibold'>{g.clase}</TableCell>
                      <TableCell></TableCell>
                      <TableCell className='text-right font-mono'>{g.cantidad}</TableCell>
                      <TableCell className='text-right font-mono'>{fmtN(g.total)}</TableCell>
                    </TableRow>
                  )
                  // Si la clase tiene varias formas distintas, mostrarlas indentadas
                  const subs = g.items.length > 1
                    ? g.items.map(it => (
                        <TableRow key={`g-${g.clase}-${it.tipo_pago}`} className='text-muted-foreground'>
                          <TableCell className='pl-6 text-xs font-mono'>{it.tipo_pago}</TableCell>
                          <TableCell className='text-xs'>{it.forma_pago}</TableCell>
                          <TableCell className='text-right font-mono text-xs'>{it.cantidad}</TableCell>
                          <TableCell className='text-right font-mono text-xs'>{fmtN(it.total)}</TableCell>
                        </TableRow>
                      ))
                    : []
                  return [head, ...subs]
                })}
                {grupos.length > 0 && (
                  <TableRow className='border-t-2 bg-muted/40 font-bold'>
                    <TableCell colSpan={3} className='text-right'>Total Ingresos</TableCell>
                    <TableCell className='text-right font-mono'>{fmtN(totalFormaPago)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Resumen por Tipo NCF (B01 / B02 / etc.) */}
          <div className='rounded-md border'>
            <div className='px-3 py-2 border-b bg-muted/40 text-sm font-semibold text-blue-700'>
              Resumen por Tipo NCF (DGII)
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-16'>Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className='w-16 text-right'>Cant.</TableHead>
                  <TableHead className='w-28 text-right'>Total Línea</TableHead>
                  <TableHead className='w-24 text-right'>Descuento</TableHead>
                  <TableHead className='w-24 text-right'>ITBIS</TableHead>
                  <TableHead className='w-28 text-right'>Total Neto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalleQ.isLoading && (
                  <TableRow><TableCell colSpan={7} className='py-6 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>
                )}
                {!detalleQ.isLoading && selectedFecha !== null && porNcf.length === 0 && (
                  <TableRow><TableCell colSpan={7} className='py-6 text-center text-muted-foreground'>Sin facturas en el período.</TableCell></TableRow>
                )}
                {porNcf.map((r) => (
                  <TableRow key={`${r.tipo_ncf_fiscal}-${r.codigo_ncf}`}>
                    <TableCell className='font-mono font-semibold'>{r.tipo_ncf_fiscal || '—'}</TableCell>
                    <TableCell className='text-sm'>
                      {labelNcf(r.tipo_ncf_fiscal)}
                      {r.codigo_ncf && r.codigo_ncf !== '—' && (
                        <span className='ml-2 text-xs text-muted-foreground'>({r.codigo_ncf})</span>
                      )}
                    </TableCell>
                    <TableCell className='text-right font-mono'>{r.cantidad}</TableCell>
                    <TableCell className='text-right font-mono'>{fmtN(r.total_linea)}</TableCell>
                    <TableCell className='text-right font-mono'>{fmtN(r.descuento)}</TableCell>
                    <TableCell className='text-right font-mono'>{fmtN(r.impuesto)}</TableCell>
                    <TableCell className='text-right font-mono font-semibold'>{fmtN(r.total_neto)}</TableCell>
                  </TableRow>
                ))}
                {porNcf.length > 0 && (
                  <TableRow className='border-t-2 bg-muted/40 font-bold'>
                    <TableCell colSpan={6} className='text-right'>TOTAL</TableCell>
                    <TableCell className='text-right font-mono'>{fmtN(totalPorNcf)}</TableCell>
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
