import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calculator, FileSpreadsheet, Printer, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props { noCia: string; punto: string; mes?: number; ano?: number }

type ResumenItem = { tipo_pago: string; forma_pago: string; cantidad: number; total: number }
type NcfItem = {
  ncf_tipo: string; cantidad: number
  total_linea: number; descuento: number; impuesto: number; total_neto: number
}
type NcfFormaPagoItem = {
  ncf_tipo: string; tipo_pago: string; forma_pago: string
  cantidad: number; total: number
}
type FacturaItem = {
  tipo_factura: string; no_factura: string; nombre_cliente: string
  ncf_dgi: string; fecha: string | null
  total_linea: number; descuento: number; impuesto: number; total_neto: number
  forma_pago: string; st_anulado: string
}
type CuadreResp = {
  fecha: string
  usuario: string
  no_cuadre: number
  resumen_pago: ResumenItem[]
  por_ncf: NcfItem[]
  por_ncf_forma_pago: NcfFormaPagoItem[]
  facturas: FacturaItem[]
}

const API = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

const fmtN = (n: number) =>
  Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function labelNcf(ncf_tipo: string): string {
  const t = (ncf_tipo || '').toUpperCase()
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

// Llama al endpoint print-data unificado: él calcula resumen, por NCF, matriz y
// (opcionalmente) la lista de facturas del día. Una sola fetch por estado.
async function fetchCuadreDia(noCia: string, punto: string, fecha: string,
                              incluirDetalle: boolean): Promise<CuadreResp> {
  const p = new URLSearchParams({ no_cia: noCia, punto, fecha })
  if (incluirDetalle) p.set('incluir_detalle', '1')
  const res = await fetch(`${API}/fat/reportes/cuadre-caja/print-data/?${p}`,
    { credentials: 'include' })
  if (!res.ok) throw new Error(await res.text())
  const json = await res.json()
  const e = json.extra || {}
  return {
    fecha: e.fecha || fecha,
    usuario: e.usuario || '',
    no_cuadre: Number(e.no_cuadre || 0),
    resumen_pago: e.resumen_pago || [],
    por_ncf: e.por_ncf || [],
    por_ncf_forma_pago: e.por_ncf_forma_pago || [],
    facturas: e.facturas || [],
  }
}

const TODAY = new Date().toISOString().slice(0, 10)

export function CuadreCajaFat({ noCia, punto }: Props) {
  // Solo hay un cuadre por día: el día seleccionado (default hoy) se hala
  // automáticamente al entrar. Sin historial, sin filtros de rango.
  const [fecha, setFecha] = useState(TODAY)
  const [incluirDetalle, setIncluirDetalle] = useState(false)

  const q = useQuery({
    queryKey: ['fat-cuadre-dia', noCia, punto, fecha, incluirDetalle],
    queryFn: () => fetchCuadreDia(noCia, punto, fecha, incluirDetalle),
    enabled: !!noCia && !!fecha,
    staleTime: 60_000,
  })

  const data = q.data
  const resumen = data?.resumen_pago ?? []
  const porNcf = data?.por_ncf ?? []
  const porNcfFormaPago = data?.por_ncf_forma_pago ?? []
  const facturas = data?.facturas ?? []

  // Cobros de crédito al final, resto alfabético por forma_pago.
  const resumenSorted = [...resumen].sort((a, b) => {
    const aCredit = (a.tipo_pago || '').startsWith('C')
    const bCredit = (b.tipo_pago || '').startsWith('C')
    if (aCredit !== bCredit) return aCredit ? 1 : -1
    return (a.forma_pago || '').localeCompare(b.forma_pago || '', 'es')
  })
  const totalFormaPago = resumen.reduce((s, r) => s + r.total, 0)
  const totalPorNcf = porNcf.reduce((s, r) => s + r.total_neto, 0)
  const totalFacturas = facturas.reduce((s, f) => s + (f.total_neto || 0), 0)

  // Matriz NCF × forma_pago.
  const ncfFormaPagoMatrix = (() => {
    const formasSet = new Set<string>()
    const filaMap = new Map<string, { ncf_tipo: string; total: number; porForma: Record<string, { cantidad: number; total: number }> }>()
    for (const r of porNcfFormaPago) {
      formasSet.add(r.forma_pago)
      let fila = filaMap.get(r.ncf_tipo)
      if (!fila) {
        fila = { ncf_tipo: r.ncf_tipo, total: 0, porForma: {} }
        filaMap.set(r.ncf_tipo, fila)
      }
      fila.porForma[r.forma_pago] = { cantidad: r.cantidad, total: r.total }
      fila.total += r.total
    }
    const formas = [...formasSet].sort((a, b) => a.localeCompare(b, 'es'))
    const filas = [...filaMap.values()].sort((a, b) => a.ncf_tipo.localeCompare(b.ncf_tipo))
    const totalesCol: Record<string, number> = {}
    for (const f of formas) {
      totalesCol[f] = filas.reduce((s, fila) => s + (fila.porForma[f]?.total ?? 0), 0)
    }
    const totalMatrix = filas.reduce((s, f) => s + f.total, 0)
    return { formas, filas, totalesCol, totalMatrix }
  })()

  const mesAno = (() => {
    const d = new Date(fecha)
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
  })()

  const exportCsv = async () => {
    if (!resumen.length && !porNcf.length) return
    const meta = await buildReportMeta(noCia, punto, mesAno)
    const rows: any[][] = []
    rows.push([`=== Cuadre de Caja del ${fecha} ${data?.usuario ? '· ' + data.usuario : ''} ===`])
    rows.push([])
    rows.push(['=== Resumen por Forma de Pago ==='])
    rows.push(['Tipo', 'Descripcion', 'Cantidad', 'Total RD'])
    for (const it of resumenSorted) {
      rows.push([it.tipo_pago, it.forma_pago, it.cantidad, Number(it.total ?? 0).toFixed(2)])
    }
    rows.push(['', '', 'TOTAL', totalFormaPago.toFixed(2)])
    rows.push([])
    rows.push(['=== Resumen por Tipo NCF ==='])
    rows.push(['Tipo NCF', 'Cantidad', 'Total Linea', 'Descuento', 'ITBIS', 'Total Neto'])
    for (const r of porNcf) {
      rows.push([r.ncf_tipo, r.cantidad,
        r.total_linea.toFixed(2), r.descuento.toFixed(2),
        r.impuesto.toFixed(2), r.total_neto.toFixed(2)])
    }
    rows.push(['', 'TOTAL', '', '', '', totalPorNcf.toFixed(2)])
    if (incluirDetalle && facturas.length) {
      rows.push([])
      rows.push(['=== Detalle de Facturas ==='])
      rows.push(['No. Factura', 'Fecha', 'Cliente', 'NCF', 'Forma Pago', 'Descuento', 'ITBIS', 'Total Neto', 'Anulada'])
      for (const f of facturas) {
        rows.push([
          `${f.tipo_factura}-${f.no_factura}`,
          (f.fecha || '').slice(0, 10),
          f.nombre_cliente, f.ncf_dgi, f.forma_pago,
          (f.descuento || 0).toFixed(2), (f.impuesto || 0).toFixed(2),
          (f.total_neto || 0).toFixed(2),
          f.st_anulado === 'S' ? 'SI' : '',
        ])
      }
      rows.push(['', '', '', '', '', '', 'TOTAL', totalFacturas.toFixed(2)])
    }
    downloadCsv(`cuadre-caja-${fecha}.csv`, [], rows, meta)
  }

  // PDF nuevo sistema: abre /print/cuadre-caja/<fecha> que usa la plantilla
  // Puck (logo + secciones configurables vía /settings/pdf-templates/cuadre-caja).
  const abrirPdf = () => {
    const u = new URLSearchParams({ no_cia: noCia, punto })
    if (incluirDetalle) u.set('incluir_detalle', '1')
    window.open(
      `/print/cuadre-caja/${encodeURIComponent(fecha)}?${u.toString()}`,
      '_blank', 'noopener')
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <Calculator className='h-5 w-5' /> Cuadre de Caja
          </h2>
          <p className='text-sm text-muted-foreground'>
            Empresa {noCia} / Punto {punto}
            {data?.no_cuadre ? ` · Cuadre #${data.no_cuadre}` : ''}
            {data?.usuario ? ` · ${data.usuario}` : ''}
          </p>
        </div>
        <div className='flex gap-2 flex-wrap'>
          <Button variant='outline' size='sm' onClick={abrirPdf}
                  disabled={!resumen.length && !porNcf.length}>
            <Printer className='mr-1 h-4 w-4' /> Imprimir PDF
          </Button>
          <Button variant='outline' size='sm' onClick={exportCsv}
                  disabled={!resumen.length && !porNcf.length}>
            <FileSpreadsheet className='mr-1 h-4 w-4' /> Excel
          </Button>
          <Button variant='outline' size='sm' onClick={() => q.refetch()}>
            <RefreshCw className='mr-1 h-4 w-4' /> Actualizar
          </Button>
        </div>
      </div>

      <div className='flex gap-4 flex-wrap items-end rounded-md border bg-muted/30 p-3'>
        <div className='space-y-1'>
          <Label htmlFor='cuadre-fecha' className='text-xs text-muted-foreground'>Fecha del cuadre</Label>
          <Input id='cuadre-fecha' type='date' value={fecha}
                 onChange={(e) => setFecha(e.target.value)}
                 className='h-9 w-44' />
        </div>
        <div className='flex items-center gap-2 pb-1'>
          <Switch id='inc-det' checked={incluirDetalle}
                  onCheckedChange={(v) => setIncluirDetalle(!!v)} />
          <Label htmlFor='inc-det' className='cursor-pointer text-sm'>
            Incluir detalle de facturas
          </Label>
        </div>
        {q.isFetching && (
          <span className='text-xs text-muted-foreground pb-2'>Cargando…</span>
        )}
        {q.error && (
          <span className='text-xs text-red-600 pb-2'>Error al cargar el cuadre.</span>
        )}
      </div>

      <div className='space-y-4'>
        {/* Resumen por Forma de Pago */}
        <div className='rounded-md border'>
          <div className='px-3 py-2 border-b bg-muted/40 text-sm font-semibold text-blue-700'>
            Resumen por Forma de Pago
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-32'>Tipo</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className='w-20 text-right'>Cant.</TableHead>
                <TableHead className='w-32 text-right'>Total RD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading && (
                <TableRow><TableCell colSpan={4} className='py-8 text-center text-muted-foreground'>Cargando cuadre del día…</TableCell></TableRow>
              )}
              {!q.isLoading && resumenSorted.length === 0 && (
                <TableRow><TableCell colSpan={4} className='py-8 text-center text-muted-foreground'>Sin movimientos para el {fecha}.</TableCell></TableRow>
              )}
              {resumenSorted.map(it => (
                <TableRow key={`${it.tipo_pago}-${it.forma_pago}`}>
                  <TableCell className='font-mono text-sm'>{it.tipo_pago}</TableCell>
                  <TableCell className='text-sm'>{it.forma_pago}</TableCell>
                  <TableCell className='text-right font-mono'>{it.cantidad}</TableCell>
                  <TableCell className='text-right font-mono tabular-nums'>{fmtN(it.total)}</TableCell>
                </TableRow>
              ))}
              {resumenSorted.length > 0 && (
                <TableRow className='border-t-2 bg-muted/40 font-bold'>
                  <TableCell colSpan={3} className='text-right'>Total Ingresos</TableCell>
                  <TableCell className='text-right font-mono tabular-nums'>{fmtN(totalFormaPago)}</TableCell>
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
              {q.isLoading && (
                <TableRow><TableCell colSpan={7} className='py-6 text-center text-muted-foreground'>Cargando…</TableCell></TableRow>
              )}
              {!q.isLoading && porNcf.length === 0 && (
                <TableRow><TableCell colSpan={7} className='py-6 text-center text-muted-foreground'>Sin facturas en el día.</TableCell></TableRow>
              )}
              {porNcf.map((r) => (
                <TableRow key={r.ncf_tipo}>
                  <TableCell className='font-mono font-semibold'>{r.ncf_tipo || '—'}</TableCell>
                  <TableCell className='text-sm'>{labelNcf(r.ncf_tipo)}</TableCell>
                  <TableCell className='text-right font-mono'>{r.cantidad}</TableCell>
                  <TableCell className='text-right font-mono tabular-nums'>{fmtN(r.total_linea)}</TableCell>
                  <TableCell className='text-right font-mono tabular-nums'>{fmtN(r.descuento)}</TableCell>
                  <TableCell className='text-right font-mono tabular-nums'>{fmtN(r.impuesto)}</TableCell>
                  <TableCell className='text-right font-mono tabular-nums font-semibold'>{fmtN(r.total_neto)}</TableCell>
                </TableRow>
              ))}
              {porNcf.length > 0 && (
                <TableRow className='border-t-2 bg-muted/40 font-bold'>
                  <TableCell colSpan={6} className='text-right'>TOTAL</TableCell>
                  <TableCell className='text-right font-mono tabular-nums'>{fmtN(totalPorNcf)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* NCF × Forma de Pago — matriz pivot */}
        {ncfFormaPagoMatrix.formas.length > 0 && (
          <div className='rounded-md border'>
            <div className='px-3 py-2 border-b bg-muted/40 text-sm font-semibold text-blue-700'>
              NCF × Forma de Pago
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-16'>NCF</TableHead>
                  <TableHead>Descripción</TableHead>
                  {ncfFormaPagoMatrix.formas.map((f) => (
                    <TableHead key={f} className='text-right'>{f}</TableHead>
                  ))}
                  <TableHead className='text-right'>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ncfFormaPagoMatrix.filas.map((fila) => (
                  <TableRow key={fila.ncf_tipo}>
                    <TableCell className='font-mono font-semibold'>{fila.ncf_tipo || '—'}</TableCell>
                    <TableCell className='text-sm'>{labelNcf(fila.ncf_tipo)}</TableCell>
                    {ncfFormaPagoMatrix.formas.map((f) => {
                      const v = fila.porForma[f]?.total ?? 0
                      return (
                        <TableCell key={f} className='text-right font-mono tabular-nums'>
                          {v ? fmtN(v) : <span className='text-muted-foreground/50'>—</span>}
                        </TableCell>
                      )
                    })}
                    <TableCell className='text-right font-mono tabular-nums font-semibold'>{fmtN(fila.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className='border-t-2 bg-muted/40 font-bold'>
                  <TableCell colSpan={2} className='text-right'>TOTAL</TableCell>
                  {ncfFormaPagoMatrix.formas.map((f) => (
                    <TableCell key={f} className='text-right font-mono tabular-nums'>
                      {fmtN(ncfFormaPagoMatrix.totalesCol[f] ?? 0)}
                    </TableCell>
                  ))}
                  <TableCell className='text-right font-mono tabular-nums'>{fmtN(ncfFormaPagoMatrix.totalMatrix)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}

        {/* Detalle de facturas — solo si el usuario lo activó */}
        {incluirDetalle && (
          <div className='rounded-md border'>
            <div className='px-3 py-2 border-b bg-muted/40 text-sm font-semibold text-blue-700'>
              Detalle de Facturas del Día ({facturas.length})
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-28'>No.</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className='w-32'>NCF</TableHead>
                  <TableHead className='w-24'>Forma Pago</TableHead>
                  <TableHead className='w-24 text-right'>Descuento</TableHead>
                  <TableHead className='w-24 text-right'>ITBIS</TableHead>
                  <TableHead className='w-28 text-right'>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.isLoading && (
                  <TableRow><TableCell colSpan={7} className='py-6 text-center text-muted-foreground'>Cargando facturas…</TableCell></TableRow>
                )}
                {!q.isLoading && facturas.length === 0 && (
                  <TableRow><TableCell colSpan={7} className='py-6 text-center text-muted-foreground'>Sin facturas para el {fecha}.</TableCell></TableRow>
                )}
                {facturas.map((f, i) => {
                  const anul = f.st_anulado === 'S'
                  return (
                    <TableRow key={`${f.tipo_factura}-${f.no_factura}-${i}`}
                              className={anul ? 'text-red-600' : ''}>
                      <TableCell className='font-mono text-sm'>
                        {f.tipo_factura}-{f.no_factura}
                        {anul && <span className='ml-1 text-xs'>(ANUL)</span>}
                      </TableCell>
                      <TableCell className='text-sm'>{(f.nombre_cliente || '').slice(0, 60)}</TableCell>
                      <TableCell className='font-mono text-xs'>{f.ncf_dgi || '—'}</TableCell>
                      <TableCell className='text-xs'>{f.forma_pago}</TableCell>
                      <TableCell className='text-right font-mono tabular-nums'>{fmtN(f.descuento || 0)}</TableCell>
                      <TableCell className='text-right font-mono tabular-nums'>{fmtN(f.impuesto || 0)}</TableCell>
                      <TableCell className='text-right font-mono tabular-nums font-semibold'>{fmtN(f.total_neto || 0)}</TableCell>
                    </TableRow>
                  )
                })}
                {facturas.length > 0 && (
                  <TableRow className='border-t-2 bg-muted/40 font-bold'>
                    <TableCell colSpan={6} className='text-right'>TOTAL ({facturas.length})</TableCell>
                    <TableCell className='text-right font-mono tabular-nums'>{fmtN(totalFacturas)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </section>
  )
}
