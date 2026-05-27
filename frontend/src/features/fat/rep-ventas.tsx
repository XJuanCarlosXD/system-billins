import { useEffect, useState } from 'react'
import { BarChart3, FileSpreadsheet, Printer } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props { noCia: string; punto: string; ano: number; mes: number }

type VentaProducto = {
  no_produ: string; descripcion: string; cantidad: number; precio_promedio: number
  total_neto: number; total_itbis: number; total_bruto: number; num_facturas: number
}

export function RepVentasProducto({ noCia, punto, ano, mes }: Props) {
  const [rows, setRows] = useState<VentaProducto[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    if (!noCia) return
    setLoading(true)
    regalGeneralApi.fatRepVentas(noCia, punto, ano, mes)
      .then((d) => setRows(d.items as VentaProducto[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [noCia, punto, ano, mes])

  const totalNeto = rows.reduce((s, r) => s + r.total_neto, 0)
  const totalItbis = rows.reduce((s, r) => s + r.total_itbis, 0)
  const totalBruto = rows.reduce((s, r) => s + r.total_bruto, 0)

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, `${String(mes).padStart(2, '0')}/${ano}`)
    downloadCsv(
    `fat-ventas-producto-${ano}${String(mes).padStart(2, '0')}.csv`,
    ['No. Producto', 'Descripción', 'Cantidad', 'Precio Prom.', 'Total Neto', 'ITBIS', 'Total Bruto', 'Facturas'],
    rows.map((r) => [r.no_produ, r.descripcion, r.cantidad, r.precio_promedio.toFixed(4),
                     r.total_neto.toFixed(2), r.total_itbis.toFixed(2), r.total_bruto.toFixed(2), r.num_facturas]),
      meta,
    )
  }

  const exportPdf = async () => {
    const meta = await buildReportMeta(noCia, punto, `${String(mes).padStart(2, '0')}/${ano}`)
    const win = window.open('', '_blank')!
    win.document.write(`<html><head><title>RFAT301 - Ventas por Producto</title>
    <style>body{font-family:Arial,sans-serif;font-size:9px;padding:20px}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:2px 5px}
    th{background:#ddd;font-weight:bold;text-align:left}.hdr{margin-bottom:10px}
    h3{margin:0;font-size:13px}.sub{color:#666}.r{text-align:right}
    .total{font-weight:bold;background:#f0f0f0}</style></head><body>
    <div class="hdr"><h3>${meta.empresa}</h3>
    <div class="sub">RFAT301 · Ventas por Producto · ${meta.periodo}</div>
    <div class="sub">Generado: ${meta.fecha}</div></div>
    <table><thead><tr><th>No. Producto</th><th>Descripción</th><th class="r">Cantidad</th>
    <th class="r">Precio Prom.</th><th class="r">Total Neto</th><th class="r">ITBIS</th>
    <th class="r">Total Bruto</th><th class="r">Facturas</th></tr></thead>
    <tbody>${rows.map((r) => `<tr>
    <td>${r.no_produ}</td><td>${r.descripcion}</td>
    <td class="r">${r.cantidad.toFixed(2)}</td><td class="r">${r.precio_promedio.toFixed(4)}</td>
    <td class="r">${r.total_neto.toFixed(2)}</td><td class="r">${r.total_itbis.toFixed(2)}</td>
    <td class="r">${r.total_bruto.toFixed(2)}</td><td class="r">${r.num_facturas}</td></tr>`).join('')}
    <tr class="total"><td colspan="4"><b>TOTALES</b></td>
    <td class="r"><b>${totalNeto.toFixed(2)}</b></td>
    <td class="r"><b>${totalItbis.toFixed(2)}</b></td>
    <td class="r"><b>${totalBruto.toFixed(2)}</b></td><td></td></tr>
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
          <Button variant='outline' size='sm' onClick={exportPdf}><Printer className='mr-1 h-4 w-4' /> PDF</Button>
          <Button variant='outline' size='sm' onClick={exportCsv}><FileSpreadsheet className='mr-1 h-4 w-4' /> Excel</Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-28'>No. Producto</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className='w-24 text-right'>Cantidad</TableHead>
            <TableHead className='w-28 text-right'>Precio Prom.</TableHead>
            <TableHead className='w-28 text-right'>Total Neto</TableHead>
            <TableHead className='w-24 text-right'>ITBIS</TableHead>
            <TableHead className='w-28 text-right'>Total Bruto</TableHead>
            <TableHead className='w-16 text-right'>Facts.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>Sin ventas para este período.</TableCell></TableRow>}
          {rows.map((row) => (
            <TableRow key={row.no_produ}>
              <TableCell className='font-mono'>{row.no_produ}</TableCell>
              <TableCell className='text-sm'>{row.descripcion}</TableCell>
              <TableCell className='text-right font-mono'>{row.cantidad.toFixed(2)}</TableCell>
              <TableCell className='text-right font-mono'>{row.precio_promedio.toFixed(4)}</TableCell>
              <TableCell className='text-right font-mono'>{row.total_neto.toFixed(2)}</TableCell>
              <TableCell className='text-right font-mono'>{row.total_itbis.toFixed(2)}</TableCell>
              <TableCell className='text-right font-mono font-semibold'>{row.total_bruto.toFixed(2)}</TableCell>
              <TableCell className='text-right text-muted-foreground'>{row.num_facturas}</TableCell>
            </TableRow>
          ))}
          {rows.length > 0 && (
            <TableRow className='border-t-2 font-semibold bg-muted/40'>
              <TableCell colSpan={4} className='text-right'>TOTALES</TableCell>
              <TableCell className='text-right font-mono'>{totalNeto.toFixed(2)}</TableCell>
              <TableCell className='text-right font-mono'>{totalItbis.toFixed(2)}</TableCell>
              <TableCell className='text-right font-mono'>{totalBruto.toFixed(2)}</TableCell>
              <TableCell />
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  )
}
