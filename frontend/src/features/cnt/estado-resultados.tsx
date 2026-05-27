import { useState } from 'react'
import { Printer, RefreshCw, FileSpreadsheet } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { buildReportMeta, downloadCsv, fmtN, printHtml } from './export-utils'

interface Props { noCia: string; punto: string; ano: number; mes: number }

const MESES_NOMBRES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
                       'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function buildEstadoResultadosPdf(
  meta: import('./export-utils').ReportMeta,
  data: any,
  ano: number,
  mesIni: number,
  mesFin: number,
) {
  const fmt = (v: number) => fmtN(v)
  const periodo = mesIni === mesFin
    ? `${MESES_NOMBRES[mesIni]} ${ano}`
    : `${MESES_NOMBRES[mesIni]} - ${MESES_NOMBRES[mesFin]} ${ano}`

  function seccionRows(rows: any[], titulo: string, total: number, color: string) {
    if (!rows.length) return ''
    const detalle = rows.map(r => `
      <tr>
        <td style="font-family:monospace;font-size:11px;padding:2px 4px">${r.cuenta}</td>
        <td style="font-size:11px;padding:2px 4px">${r.descripcion}</td>
        <td style="text-align:right;font-family:monospace;font-size:11px;padding:2px 8px">${fmt(r.saldo)}</td>
      </tr>`).join('')
    return `
      <tr><td colspan="3" style="background:${color};font-weight:bold;font-size:12px;padding:4px 4px">${titulo}</td></tr>
      ${detalle}
      <tr style="border-top:1px solid #999">
        <td colspan="2" style="text-align:right;font-size:11px;padding:3px 4px"><b>Total ${titulo}:</b></td>
        <td style="text-align:right;font-family:monospace;font-size:11px;font-weight:bold;padding:3px 8px">${fmt(total)}</td>
      </tr>
      <tr><td colspan="3" style="height:8px"></td></tr>
    `
  }

  const body = `
    <h3 style="text-align:center;margin:8px 0;font-size:14px">ESTADO DE RESULTADOS</h3>
    <p style="text-align:center;margin:0 0 12px;font-size:12px">Periodo: ${periodo}</p>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#e0e0e0">
          <th style="text-align:left;padding:3px 4px;font-size:11px;width:120px">Cuenta</th>
          <th style="text-align:left;padding:3px 4px;font-size:11px">Descripcion</th>
          <th style="text-align:right;padding:3px 8px;font-size:11px;width:130px">Importe</th>
        </tr>
      </thead>
      <tbody>
        ${seccionRows(data.ingresos, 'INGRESOS', data.total_ingresos, '#e8f5e9')}
        ${seccionRows(data.costos, 'COSTO DE VENTAS', data.total_costos, '#fff8e1')}
        <tr style="background:#e3f2fd;border-top:2px solid #1565c0">
          <td colspan="2" style="text-align:right;font-size:12px;font-weight:bold;padding:4px 4px">UTILIDAD BRUTA:</td>
          <td style="text-align:right;font-family:monospace;font-size:12px;font-weight:bold;padding:4px 8px">${fmt(data.utilidad_bruta)}</td>
        </tr>
        <tr><td colspan="3" style="height:10px"></td></tr>
        ${seccionRows(data.gastos, 'GASTOS OPERATIVOS', data.total_gastos, '#fce4ec')}
        <tr style="background:#ede7f6;border-top:2px solid #4527a0">
          <td colspan="2" style="text-align:right;font-size:13px;font-weight:bold;padding:5px 4px">UTILIDAD NETA:</td>
          <td style="text-align:right;font-family:monospace;font-size:13px;font-weight:bold;padding:5px 8px;color:${data.utilidad_neta >= 0 ? '#1b5e20' : '#b71c1c'}">${fmt(data.utilidad_neta)}</td>
        </tr>
      </tbody>
    </table>
  `
  printHtml(`Estado de Resultados ${periodo} - ${meta.company}`, body)
}

export function EstadoResultados({ noCia, punto, ano, mes }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [mesIni, setMesIni] = useState(mes)
  const [mesFin, setMesFin] = useState(mes)

  const load = () => {
    setLoading(true)
    regalGeneralApi.cntEstadoResultados(noCia, punto, ano, mesIni, mesFin)
      .then(setData)
      .finally(() => setLoading(false))
  }

  const fmt = (v: any) => {
    const n = Number(v || 0)
    return n.toLocaleString('es-DO', { minimumFractionDigits: 2 })
  }

  const clsImporte = (v: number) =>
    v < 0 ? 'text-right font-mono text-red-600' : 'text-right font-mono'

  const exportCsv = () => {
    if (!data) return
    const rows: any[][] = []
    rows.push(['INGRESOS'])
    data.ingresos.forEach((r: any) => rows.push([r.cuenta, r.descripcion, r.saldo]))
    rows.push(['Total Ingresos', '', data.total_ingresos])
    rows.push([])
    rows.push(['COSTO DE VENTAS'])
    data.costos.forEach((r: any) => rows.push([r.cuenta, r.descripcion, r.saldo]))
    rows.push(['Total Costos', '', data.total_costos])
    rows.push(['UTILIDAD BRUTA', '', data.utilidad_bruta])
    rows.push([])
    rows.push(['GASTOS OPERATIVOS'])
    data.gastos.forEach((r: any) => rows.push([r.cuenta, r.descripcion, r.saldo]))
    rows.push(['Total Gastos', '', data.total_gastos])
    rows.push(['UTILIDAD NETA', '', data.utilidad_neta])
    downloadCsv(
      `cnt-estado-resultados-${noCia}-${punto}-${ano}-${mesIni}-${mesFin}.csv`,
      ['Concepto', 'Descripcion', 'Importe'],
      rows,
    )
  }

  const exportPdf = async () => {
    if (!data) return
    const meta = await buildReportMeta(noCia, punto, `${String(mesIni).padStart(2,'0')}-${ano}`)
    buildEstadoResultadosPdf(meta, data, ano, mesIni, mesFin)
  }

  const MESES_OPT = MESES_NOMBRES.slice(1).map((m, i) => ({ value: i + 1, label: m }))

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>Estado de Resultados</h2>
          <p className='text-sm text-muted-foreground'>
            {ano} — {MESES_NOMBRES[mesIni]}{mesIni !== mesFin ? ` a ${MESES_NOMBRES[mesFin]}` : ''}
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          {data && (
            <>
              <Button variant='outline' size='sm' onClick={exportPdf}>
                <Printer className='mr-2 h-4 w-4' /> PDF
              </Button>
              <Button variant='outline' size='sm' onClick={exportCsv}>
                <FileSpreadsheet className='mr-2 h-4 w-4' /> Excel
              </Button>
            </>
          )}
          <Button size='sm' onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {data ? 'Actualizar' : 'Generar'}
          </Button>
        </div>
      </div>

      {/* Filtro de rango de meses */}
      <div className='flex flex-wrap items-center gap-3 rounded-lg border p-3'>
        <span className='text-sm font-medium'>Periodo:</span>
        <div className='flex items-center gap-2'>
          <label className='text-sm text-muted-foreground'>Desde</label>
          <select
            className='h-8 rounded border px-2 text-sm'
            value={mesIni}
            onChange={e => setMesIni(Number(e.target.value))}
          >
            {MESES_OPT.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className='flex items-center gap-2'>
          <label className='text-sm text-muted-foreground'>Hasta</label>
          <select
            className='h-8 rounded border px-2 text-sm'
            value={mesFin}
            onChange={e => setMesFin(Number(e.target.value))}
          >
            {MESES_OPT.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>

      {data ? (
        <div className='grid gap-6'>
          {/* Ingresos */}
          <div className='rounded-lg border'>
            <div className='rounded-t-lg bg-green-50 dark:bg-green-950 px-4 py-2 font-semibold'>
              Ingresos
            </div>
            <table className='w-full text-sm'>
              <tbody>
                {data.ingresos.map((r: any) => (
                  <tr key={r.cuenta} className='border-t'>
                    <td className='px-4 py-1.5 font-mono text-xs'>{r.cuenta}</td>
                    <td className='px-2 py-1.5'>{r.descripcion}</td>
                    <td className='px-4 py-1.5 text-right font-mono'>{fmt(r.saldo)}</td>
                  </tr>
                ))}
                {data.ingresos.length === 0 && (
                  <tr><td colSpan={3} className='px-4 py-2 text-center text-muted-foreground text-xs'>Sin movimientos</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className='border-t-2 bg-green-100 dark:bg-green-900 font-bold'>
                  <td colSpan={2} className='px-4 py-2 text-right text-sm'>Total Ingresos</td>
                  <td className='px-4 py-2 text-right font-mono text-sm'>{fmt(data.total_ingresos)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Costo de Ventas */}
          <div className='rounded-lg border'>
            <div className='rounded-t-lg bg-yellow-50 dark:bg-yellow-950 px-4 py-2 font-semibold'>
              Costo de Ventas
            </div>
            <table className='w-full text-sm'>
              <tbody>
                {data.costos.map((r: any) => (
                  <tr key={r.cuenta} className='border-t'>
                    <td className='px-4 py-1.5 font-mono text-xs'>{r.cuenta}</td>
                    <td className='px-2 py-1.5'>{r.descripcion}</td>
                    <td className='px-4 py-1.5 text-right font-mono'>{fmt(r.saldo)}</td>
                  </tr>
                ))}
                {data.costos.length === 0 && (
                  <tr><td colSpan={3} className='px-4 py-2 text-center text-muted-foreground text-xs'>Sin movimientos</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className='border-t-2 bg-yellow-100 dark:bg-yellow-900 font-bold'>
                  <td colSpan={2} className='px-4 py-2 text-right text-sm'>Total Costo de Ventas</td>
                  <td className='px-4 py-2 text-right font-mono text-sm'>{fmt(data.total_costos)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Utilidad Bruta */}
          <div className='rounded-lg bg-blue-50 dark:bg-blue-950 border-2 border-blue-300 dark:border-blue-700 px-4 py-3 flex items-center justify-between'>
            <span className='font-bold text-base'>Utilidad Bruta</span>
            <span className={`font-bold text-base font-mono ${data.utilidad_bruta < 0 ? 'text-red-600' : 'text-blue-700 dark:text-blue-300'}`}>
              {fmt(data.utilidad_bruta)}
            </span>
          </div>

          {/* Gastos Operativos */}
          <div className='rounded-lg border'>
            <div className='rounded-t-lg bg-red-50 dark:bg-red-950 px-4 py-2 font-semibold'>
              Gastos Operativos
            </div>
            <table className='w-full text-sm'>
              <tbody>
                {data.gastos.map((r: any) => (
                  <tr key={r.cuenta} className='border-t'>
                    <td className='px-4 py-1.5 font-mono text-xs'>{r.cuenta}</td>
                    <td className='px-2 py-1.5'>{r.descripcion}</td>
                    <td className='px-4 py-1.5 text-right font-mono'>{fmt(r.saldo)}</td>
                  </tr>
                ))}
                {data.gastos.length === 0 && (
                  <tr><td colSpan={3} className='px-4 py-2 text-center text-muted-foreground text-xs'>Sin movimientos</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className='border-t-2 bg-red-100 dark:bg-red-900 font-bold'>
                  <td colSpan={2} className='px-4 py-2 text-right text-sm'>Total Gastos Operativos</td>
                  <td className='px-4 py-2 text-right font-mono text-sm'>{fmt(data.total_gastos)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Utilidad Neta */}
          <div className={`rounded-lg border-2 px-4 py-4 flex items-center justify-between ${data.utilidad_neta >= 0 ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-400 dark:border-emerald-600' : 'bg-red-50 dark:bg-red-950 border-red-400 dark:border-red-600'}`}>
            <span className='font-bold text-lg'>UTILIDAD NETA</span>
            <span className={`font-bold text-xl font-mono ${data.utilidad_neta < 0 ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-300'}`}>
              {fmt(data.utilidad_neta)}
            </span>
          </div>
        </div>
      ) : (
        !loading && (
          <div className='rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground'>
            Selecciona el periodo y presiona Generar para consultar el Estado de Resultados.
          </div>
        )
      )}
    </section>
  )
}