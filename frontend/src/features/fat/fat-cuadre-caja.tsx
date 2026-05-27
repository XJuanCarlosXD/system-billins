import { useEffect, useState } from 'react'
import { Calculator, FileSpreadsheet, Printer } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props { noCia: string; punto: string; ano: number; mes: number }

type CuadreCabecera = {
  no_cuadre_caja: number; fecha: string; usuario: string; total_monto: number
}
type CuadreDetalle = {
  tipo_pago: string; forma_pago: string; cantidad: number; total: number
}

const fmtDate = (d: any) => d ? String(d).slice(0, 10) : '—'
const fmtNum = (n: number) => Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function CuadreCajaFat({ noCia, punto, ano, mes }: Props) {
  const [rows, setRows] = useState<CuadreCabecera[]>([])
  const [detalle, setDetalle] = useState<CuadreDetalle[]>([])
  const [selected, setSelected] = useState<CuadreCabecera | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingDet, setLoadingDet] = useState(false)

  const load = () => {
    if (!noCia) return
    setLoading(true)
    regalGeneralApi.fatCuadreCaja(noCia, punto, ano, mes)
      .then((d) => {
        const items = (d.historial ?? []) as CuadreCabecera[]
        setRows(items)
        if (items.length) { setSelected(items[0]); loadDetalle() }
        else { setDetalle([]) }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const loadDetalle = () => {
    setLoadingDet(true)
    regalGeneralApi.fatCuadreCaja(noCia, punto, ano, mes)
      .then((d) => setDetalle((d.resumen ?? []) as CuadreDetalle[]))
      .catch(() => {})
      .finally(() => setLoadingDet(false))
  }

  useEffect(() => { setSelected(null); setDetalle([]); load() }, [noCia, punto, ano, mes])

  const selectCuadre = (row: CuadreCabecera) => {
    setSelected(row)
    loadDetalle()
  }

  const grandTotal = detalle.reduce((s, d) => s + (d.total ?? 0), 0)

  const mesAno = `${String(mes).padStart(2, '0')}-${ano}`

  const exportCsv = async () => {
    if (!selected) return
    const meta = await buildReportMeta(noCia, punto, mesAno)
    downloadCsv(
      `fat-cuadre-${selected.no_cuadre_caja}.csv`,
      ['Tipo Pago', 'Descripcion', 'Cantidad', 'Total RD'],
      detalle.map((d) => [d.tipo_pago, d.forma_pago, d.cantidad, Number(d.total ?? 0).toFixed(2)]),
      meta,
    )
  }

  const exportPdf = async () => {
    if (!selected) return
    const meta = await buildReportMeta(noCia, punto, mesAno)
    const now = new Date()
    const fecha = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`
    const win = window.open('', '_blank')!
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>
    <title>Cuadre de Caja ${selected.no_cuadre_caja}</title>
    <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    body{font-family:Arial,sans-serif;font-size:8pt;color:#000;background:#fff;-webkit-print-color-adjust:exact}
    .rh{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px}
    .rh-left .co{font-size:11pt;font-weight:bold;line-height:1.3}
    .rh-left .co-line{font-size:8pt;line-height:1.5}
    .rh-right{font-size:8pt;text-align:right;line-height:1.5;white-space:nowrap}
    .rh-right .rep-code{font-size:10pt;font-weight:bold}
    .sep-double{border:none;border-top:3px double #000;margin:4px 0 2px 0}
    .info-line{font-size:8pt;margin-bottom:6px;color:#333}
    table.rpt{width:100%;border-collapse:collapse;font-size:8pt;margin-top:4px;border:1px solid #000}
    table.rpt thead th{font-weight:bold;text-align:left;border:1px solid #000;padding:3px 5px;white-space:nowrap;background:#e8e8e8}
    table.rpt thead th.r{text-align:right}
    table.rpt tbody td{padding:2px 5px;vertical-align:top;border:1px solid #000;line-height:1.4}
    table.rpt tbody td.r{text-align:right}
    table.rpt tfoot td{border:1px solid #000;font-weight:bold;padding:3px 5px;font-size:8pt;background:#e8e8e8}
    table.rpt tfoot td.r{text-align:right}
    @page{size:letter portrait;margin:1.4cm 1.5cm 1.6cm 1.5cm}
    @media print{body{margin:0;-webkit-print-color-adjust:exact}table{page-break-inside:avoid}}
    </style></head><body>
    <div class="rh">
      <div class="rh-left">
        <div class="co">${meta.company}</div>
        ${meta.direccion1 ? `<div class="co-line">${meta.direccion1}</div>` : ''}
        ${meta.ciudad ? `<div class="co-line">${meta.ciudad}</div>` : ''}
        ${meta.telefono ? `<div class="co-line">Tel. ${meta.telefono}</div>` : ''}
        ${meta.rnc ? `<div class="co-line">RNC ${meta.rnc}</div>` : ''}
        <div class="co-line">${fecha}</div>
      </div>
      <div class="rh-right">
        <div>Facturación</div>
        <div class="rep-code">FFAT</div>
        <div>Cuadre de Caja</div>
        <div>${mesAno}</div>
      </div>
    </div>
    <hr class="sep-double"/>
    <div class="info-line">Cuadre No. ${selected.no_cuadre_caja} &nbsp;&mdash;&nbsp; Fecha: ${fmtDate(selected.fecha)} &nbsp;&mdash;&nbsp; Usuario: ${selected.usuario}</div>
    <table class="rpt"><thead><tr>
    <th>Tipo Pago</th><th>Descripcion</th><th class="r">Cantidad</th><th class="r">Total RD</th></tr></thead>
    <tbody>${detalle.map((d) => `<tr>
    <td>${d.tipo_pago}</td><td>${d.forma_pago}</td>
    <td class="r">${d.cantidad}</td>
    <td class="r">${fmtNum(d.total)}</td></tr>`).join('')}
    </tbody>
    <tfoot><tr><td colspan="3"><b>TOTAL</b></td>
    <td class="r"><b>${fmtNum(grandTotal)}</b></td></tr></tfoot>
    </table></body></html>`)
    win.document.close(); win.print()
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <Calculator className='h-5 w-5' /> Cuadre de Caja
          </h2>
          <p className='text-sm text-muted-foreground'>FFAT — Empresa {noCia} · Punto {punto}</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={exportPdf} disabled={!selected}><Printer className='mr-1 h-4 w-4' /> PDF</Button>
          <Button variant='outline' size='sm' onClick={exportCsv} disabled={!selected}><FileSpreadsheet className='mr-1 h-4 w-4' /> Excel</Button>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-3'>
        {/* Lista de cuadres */}
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-24'>No. Cuadre</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={3} className='py-6 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
              {!loading && rows.length === 0 && <TableRow><TableCell colSpan={3} className='py-6 text-center text-muted-foreground'>Sin cuadres en este periodo.</TableCell></TableRow>}
              {rows.map((row) => (
                <TableRow key={row.no_cuadre_caja}
                  className={`cursor-pointer ${selected?.no_cuadre_caja === row.no_cuadre_caja ? 'bg-muted' : ''}`}
                  onClick={() => selectCuadre(row)}>
                  <TableCell className='font-mono font-semibold'>{row.no_cuadre_caja}</TableCell>
                  <TableCell className='text-sm'>{fmtDate(row.fecha)}</TableCell>
                  <TableCell className='text-sm'>{row.usuario}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Detalle del cuadre */}
        <div className='lg:col-span-2 rounded-md border'>
          {selected && (
            <div className='p-3 border-b text-sm font-medium'>
              Cuadre #{selected.no_cuadre_caja} — {fmtDate(selected.fecha)}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-20'>Tipo</TableHead>
                <TableHead>Descripcion</TableHead>
                <TableHead className='w-20 text-right'>Cant.</TableHead>
                <TableHead className='w-28 text-right'>Total RD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingDet && <TableRow><TableCell colSpan={4} className='py-6 text-center text-muted-foreground'>Cargando detalle...</TableCell></TableRow>}
              {!loadingDet && !selected && <TableRow><TableCell colSpan={4} className='py-6 text-center text-muted-foreground'>Seleccione un cuadre para ver el detalle.</TableCell></TableRow>}
              {!loadingDet && selected && detalle.length === 0 && <TableRow><TableCell colSpan={4} className='py-6 text-center text-muted-foreground'>Sin movimientos.</TableCell></TableRow>}
              {detalle.map((d) => (
                <TableRow key={d.tipo_pago}>
                  <TableCell className='font-mono'>{d.tipo_pago}</TableCell>
                  <TableCell>{d.forma_pago}</TableCell>
                  <TableCell className='text-right font-mono'>{d.cantidad}</TableCell>
                  <TableCell className='text-right font-mono'>{fmtNum(d.total)}</TableCell>
                </TableRow>
              ))}
              {detalle.length > 0 && (
                <TableRow className='border-t-2 font-semibold bg-muted/40'>
                  <TableCell colSpan={3} className='text-right'>TOTAL</TableCell>
                  <TableCell className='text-right font-mono'>{fmtNum(grandTotal)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  )
}
