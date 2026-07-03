import { useEffect, useState } from 'react'
import { TrendingUp, FileSpreadsheet, Printer, RefreshCw } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props { noCia: string; punto: string; ano?: number }

type MesData = {
  mes: number; facturas: number
  total_neto: number; total_itbis: number; total_bruto: number
}
type Producto = { no_produ: string; descripcion: string; cantidad: number; total_neto: number }
type Cliente = { no_cliente: number; nombre_cliente: string; facturas: number; total_neto: number }

interface AnaliticaData {
  mensual: MesData[]
  top_productos: Producto[]
  top_clientes: Cliente[]
  total_ano: number
  total_itbis_ano: number
  total_facturas: number
  ano: number
}

const MESES_ABR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const BAR_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16','#ec4899','#64748b','#0ea5e9','#a3e635']

const fmtN = (n: number) => Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtK = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(1)}K` : fmtN(n)

function KpiCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className='pb-1 pt-3 px-4'>
        <CardTitle className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>{title}</CardTitle>
      </CardHeader>
      <CardContent className='px-4 pb-3'>
        <div className='text-2xl font-bold font-mono'>{value}</div>
        {sub && <div className='text-xs text-muted-foreground mt-0.5'>{sub}</div>}
      </CardContent>
    </Card>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className='bg-background border rounded-lg shadow-lg p-3 text-xs space-y-1'>
      <div className='font-semibold text-sm'>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className='flex items-center gap-2'>
          <span className='w-2 h-2 rounded-full inline-block' style={{ background: p.color }} />
          <span className='text-muted-foreground'>{p.name}:</span>
          <span className='font-mono font-semibold'>{fmtN(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function RepAnaliticaVentas({ noCia, punto, ano = new Date().getFullYear() }: Props) {
  const [data, setData] = useState<AnaliticaData | null>(null)
  const [loading, setLoading] = useState(false)

  const load = () => {
    if (!noCia) return
    setLoading(true)
    regalGeneralApi.fatRepAnalitica(noCia, punto, ano)
      .then((d) => setData(d as AnaliticaData))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [noCia, punto, ano])

  const chartData = data?.mensual.map((m) => ({
    name: MESES_ABR[m.mes - 1],
    'Neto': m.total_neto,
    'ITBIS': m.total_itbis,
    'Bruto': m.total_bruto,
    facturas: m.facturas,
  })) ?? []

  const mejorMes = data?.mensual.reduce((best, m) => m.total_neto > best.total_neto ? m : best, { mes: 0, total_neto: 0, facturas: 0, total_itbis: 0, total_bruto: 0 })
  const promMensual = data ? data.total_ano / 12 : 0

  const mesAno = `01-${ano}`

  const exportPdf = async () => {
    if (!data) return
    const meta = await buildReportMeta(noCia, punto, mesAno)
    const now = new Date()
    const fecha = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`
    const win = window.open('', '_blank')!
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>
    <title>RFAT310 - Analitica de Ventas ${ano}</title>
    <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    body{font-family:Arial,sans-serif;font-size:8pt;color:#000;background:#fff;-webkit-print-color-adjust:exact}
    .rh{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px}
    .rh-left .co{font-size:11pt;font-weight:bold;line-height:1.3}
    .rh-left .co-line{font-size:8pt;line-height:1.5}
    .rh-right{font-size:8pt;text-align:right;line-height:1.5;white-space:nowrap}
    .rh-right .rep-code{font-size:10pt;font-weight:bold}
    .sep-double{border:none;border-top:3px double #000;margin:4px 0 2px 0}
    table.rpt{width:100%;border-collapse:collapse;font-size:8pt;margin-top:4px;border:1px solid #000;margin-bottom:12px}
    table.rpt thead th{font-weight:bold;text-align:left;border:1px solid #000;padding:3px 5px;white-space:nowrap;background:#e8e8e8}
    table.rpt thead th.r{text-align:right}
    table.rpt tbody td{padding:2px 5px;vertical-align:top;border:1px solid #000;line-height:1.4}
    table.rpt tbody td.r{text-align:right}
    table.rpt tfoot td{border:1px solid #000;font-weight:bold;padding:3px 5px;font-size:8pt;background:#e8e8e8}
    table.rpt tfoot td.r{text-align:right}
    .section-title{font-size:9pt;font-weight:bold;margin:8px 0 3px 0}
    .kpis{display:flex;gap:10px;margin:6px 0 10px 0}
    .kpi{border:1px solid #ccc;padding:6px 10px;border-radius:3px;flex:1;text-align:center}
    .kpi-val{font-size:12pt;font-weight:bold;color:#1a56db}
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
        <div class="rep-code">RFAT310</div>
        <div>Analitica de Ventas</div>
        <div>Año ${ano}</div>
      </div>
    </div>
    <hr class="sep-double"/>
    <div class="kpis">
      <div class="kpi"><div class="kpi-val">${fmtN(data.total_ano)}</div><div>Total Neto Año</div></div>
      <div class="kpi"><div class="kpi-val">${fmtN(data.total_itbis_ano)}</div><div>Total ITBIS Año</div></div>
      <div class="kpi"><div class="kpi-val">${data.total_facturas}</div><div>Total Facturas</div></div>
      <div class="kpi"><div class="kpi-val">${fmtN(promMensual)}</div><div>Promedio Mensual</div></div>
    </div>
    <div class="section-title">Ventas Mensuales</div>
    <table class="rpt"><thead><tr><th>Mes</th><th class="r">Facturas</th><th class="r">Total Neto</th><th class="r">ITBIS</th><th class="r">Total Bruto</th></tr></thead>
    <tbody>${data.mensual.map(m => `<tr>
    <td>${MESES_FULL[m.mes-1]}</td>
    <td class="r">${m.facturas}</td>
    <td class="r">${fmtN(m.total_neto)}</td>
    <td class="r">${fmtN(m.total_itbis)}</td>
    <td class="r">${fmtN(m.total_bruto)}</td></tr>`).join('')}
    </tbody>
    <tfoot><tr><td><b>TOTAL</b></td>
    <td class="r"><b>${data.total_facturas}</b></td>
    <td class="r"><b>${fmtN(data.total_ano)}</b></td>
    <td class="r"><b>${fmtN(data.total_itbis_ano)}</b></td>
    <td class="r"><b>${fmtN(data.total_ano + data.total_itbis_ano)}</b></td></tr></tfoot>
    </table>
    <div class="section-title">Top 10 Productos</div>
    <table class="rpt"><thead><tr><th>No. Prod</th><th>Descripcion</th><th class="r">Cantidad</th><th class="r">Total Neto</th></tr></thead>
    <tbody>${data.top_productos.map(p => `<tr><td>${p.no_produ}</td><td>${p.descripcion}</td>
    <td class="r">${fmtN(p.cantidad)}</td><td class="r">${fmtN(p.total_neto)}</td></tr>`).join('')}
    </tbody></table>
    <div class="section-title">Top 10 Clientes</div>
    <table class="rpt"><thead><tr><th>No.</th><th>Cliente</th><th class="r">Facturas</th><th class="r">Total Neto</th></tr></thead>
    <tbody>${data.top_clientes.map(c => `<tr><td>${c.no_cliente}</td><td>${c.nombre_cliente}</td>
    <td class="r">${c.facturas}</td><td class="r">${fmtN(c.total_neto)}</td></tr>`).join('')}
    </tbody></table>
    </body></html>`)
    win.document.close(); win.print()
  }

  const exportCsv = async () => {
    if (!data) return
    const meta = await buildReportMeta(noCia, punto, mesAno)
    downloadCsv(
      `fat-analitica-${ano}.csv`,
      ['Mes', 'Facturas', 'Total Neto', 'ITBIS', 'Total Bruto'],
      data.mensual.map(m => [MESES_FULL[m.mes-1], m.facturas, fmtN(m.total_neto), fmtN(m.total_itbis), fmtN(m.total_bruto)]),
      meta,
    )
  }

  if (loading) return <div className='py-20 text-center text-muted-foreground'>Cargando analitica...</div>

  return (
    <section className='space-y-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <TrendingUp className='h-5 w-5' /> Analitica de Ventas — {ano}
          </h2>
          <p className='text-sm text-muted-foreground'>RFAT310 — Empresa {noCia} · Punto {punto}</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='ghost' size='sm' onClick={load}><RefreshCw className='mr-1 h-4 w-4' /> Actualizar</Button>
          <Button variant='outline' size='sm' onClick={exportPdf}><Printer className='mr-1 h-4 w-4' /> PDF</Button>
          <Button variant='outline' size='sm' onClick={exportCsv}><FileSpreadsheet className='mr-1 h-4 w-4' /> Excel</Button>
        </div>
      </div>

      {data && (
        <>
          {/* KPI Cards */}
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
            <KpiCard title='Total Neto Año' value={fmtK(data.total_ano)} sub={`${ano}`} />
            <KpiCard title='Total ITBIS Año' value={fmtK(data.total_itbis_ano)} />
            <KpiCard title='Total Facturas' value={data.total_facturas.toLocaleString()} />
            <KpiCard title='Promedio Mensual' value={fmtK(promMensual)}
              sub={mejorMes && mejorMes.mes > 0 ? `Mejor: ${MESES_FULL[mejorMes.mes-1]}` : undefined} />
          </div>

          {/* Bar chart — monthly sales */}
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm'>Ventas Mensuales — {ano}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width='100%' height={280}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
                  <XAxis dataKey='name' tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey='Neto' fill='#3b82f6' radius={[3,3,0,0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Line chart — Neto vs ITBIS trend */}
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm'>Tendencia Neto vs ITBIS</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width='100%' height={220}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
                  <XAxis dataKey='name' tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type='monotone' dataKey='Neto' stroke='#3b82f6' strokeWidth={2} dot={{ r: 3 }} />
                  <Line type='monotone' dataKey='ITBIS' stroke='#f59e0b' strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Monthly detail table */}
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm'>Detalle Mensual</CardTitle>
            </CardHeader>
            <CardContent className='p-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mes</TableHead>
                    <TableHead className='w-20 text-right'>Facturas</TableHead>
                    <TableHead className='w-32 text-right'>Total Neto</TableHead>
                    <TableHead className='w-28 text-right'>ITBIS</TableHead>
                    <TableHead className='w-32 text-right'>Total Bruto</TableHead>
                    <TableHead className='w-28 text-right'>% del Año</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.mensual.map((m) => (
                    <TableRow key={m.mes} className={m.mes === mejorMes?.mes && mejorMes.total_neto > 0 ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}>
                      <TableCell className='font-medium text-sm'>{MESES_FULL[m.mes - 1]}</TableCell>
                      <TableCell className='text-right text-sm'>{m.facturas}</TableCell>
                      <TableCell className='text-right font-mono text-sm'>{fmtN(m.total_neto)}</TableCell>
                      <TableCell className='text-right font-mono text-sm'>{fmtN(m.total_itbis)}</TableCell>
                      <TableCell className='text-right font-mono text-sm'>{fmtN(m.total_bruto)}</TableCell>
                      <TableCell className='text-right text-sm text-muted-foreground'>
                        {data.total_ano > 0 ? ((m.total_neto / data.total_ano) * 100).toFixed(1) : '0.0'}%
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className='border-t-2 font-semibold bg-muted/40'>
                    <TableCell>TOTAL {ano}</TableCell>
                    <TableCell className='text-right font-mono'>{data.total_facturas}</TableCell>
                    <TableCell className='text-right font-mono'>{fmtN(data.total_ano)}</TableCell>
                    <TableCell className='text-right font-mono'>{fmtN(data.total_itbis_ano)}</TableCell>
                    <TableCell className='text-right font-mono'>{fmtN(data.total_ano + data.total_itbis_ano)}</TableCell>
                    <TableCell className='text-right'>100.0%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Top Products + Top Clients */}
          <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm'>Top 10 Productos — {ano}</CardTitle>
              </CardHeader>
              <CardContent className='p-0'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-8 text-center'>#</TableHead>
                      <TableHead className='w-24'>No. Prod</TableHead>
                      <TableHead>Descripcion</TableHead>
                      <TableHead className='w-24 text-right'>Total Neto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.top_productos.length === 0 && (
                      <TableRow><TableCell colSpan={4} className='text-center text-muted-foreground py-6'>Sin datos</TableCell></TableRow>
                    )}
                    {data.top_productos.map((p, i) => (
                      <TableRow key={p.no_produ}>
                        <TableCell className='text-center text-xs text-muted-foreground'>{i + 1}</TableCell>
                        <TableCell className='font-mono text-xs'>{p.no_produ}</TableCell>
                        <TableCell className='text-xs'>{p.descripcion}</TableCell>
                        <TableCell className='text-right font-mono text-xs font-semibold'>{fmtN(p.total_neto)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm'>Top 10 Clientes — {ano}</CardTitle>
              </CardHeader>
              <CardContent className='p-0'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-8 text-center'>#</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className='w-16 text-right'>Facts.</TableHead>
                      <TableHead className='w-28 text-right'>Total Neto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.top_clientes.length === 0 && (
                      <TableRow><TableCell colSpan={4} className='text-center text-muted-foreground py-6'>Sin datos</TableCell></TableRow>
                    )}
                    {data.top_clientes.map((c, i) => (
                      <TableRow key={c.no_cliente}>
                        <TableCell className='text-center text-xs text-muted-foreground'>{i + 1}</TableCell>
                        <TableCell className='text-xs font-medium'>{c.nombre_cliente}</TableCell>
                        <TableCell className='text-right text-xs'>{c.facturas}</TableCell>
                        <TableCell className='text-right font-mono text-xs font-semibold'>{fmtN(c.total_neto)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {!data && !loading && (
        <div className='py-20 text-center text-muted-foreground'>
          Sin datos para el año {ano}.
        </div>
      )}
    </section>
  )
}
