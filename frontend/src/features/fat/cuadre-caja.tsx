import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calculator, FileSpreadsheet, Printer, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props {
  noCia: string
  punto: string
  mes?: number
  ano?: number
}

type ResumenItem = {
  tipo_pago: string
  forma_pago: string
  cantidad: number
  total: number
}

type NcfFormaPagoItem = {
  ncf_tipo: string
  tipo_pago: string
  forma_pago: string
  cantidad: number
  total: number
}

type VentasDiaItem = {
  clase: string
  descripcion: string
  cantidad: number
  total: number
  impacta_ingreso: boolean
}

type FacturaItem = {
  tipo_factura: string
  no_factura: string
  nombre_cliente: string
  ncf_dgi: string
  posiciones_fijas_ncf?: string | null
  fecha: string | null
  total_linea: number
  descuento: number
  impuesto: number
  total_neto: number
  forma_pago: string
  st_anulado: string
  tipo_anula_dgii?: string
  motivo_anulacion?: string
}

type CuadreResp = {
  fecha: string
  fecha_solicitada: string
  dia_en_progreso: boolean
  usuario: string
  no_cuadre: number
  resumen_ventas: VentasDiaItem[]
  resumen_pago: ResumenItem[]
  por_ncf_forma_pago: NcfFormaPagoItem[]
  facturas: FacturaItem[]
}

type FacturaGroup = {
  ncfTipo: string
  rows: FacturaItem[]
  total: number
  itbis: number
  descuento: number
}

const API = import.meta.env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

const TODAY = new Date().toISOString().slice(0, 10)

const fmtN = (n: number) =>
  Number(n ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

function labelNcf(ncfTipo: string): string {
  const t = (ncfTipo || '').toUpperCase()
  const map: Record<string, string> = {
    B01: 'B01 - Credito Fiscal',
    B02: 'B02 - Consumo',
    B03: 'B03 - Nota de Debito',
    B04: 'B04 - Nota de Credito',
    B11: 'B11 - Proveedor Informal',
    B12: 'B12 - Registro Unico',
    B13: 'B13 - Gastos Menores',
    B14: 'B14 - Regimen Especial',
    B15: 'B15 - Gubernamental',
    B16: 'B16 - Exportacion',
  }
  return map[t] || t || 'SIN NCF'
}

function getFacturaNcfTipo(factura: FacturaItem): string {
  const fixed = (factura.posiciones_fijas_ncf || '').trim().toUpperCase()
  if (fixed) return fixed

  const dgi = (factura.ncf_dgi || '').trim().toUpperCase()
  if (/^B\d{2}/.test(dgi)) return dgi.slice(0, 3)

  return 'SIN NCF'
}

function groupFacturasPorNcf(facturas: FacturaItem[]): FacturaGroup[] {
  const groups = new Map<string, FacturaGroup>()

  for (const factura of facturas) {
    const ncfTipo = getFacturaNcfTipo(factura)
    const group =
      groups.get(ncfTipo) ??
      ({
        ncfTipo,
        rows: [],
        total: 0,
        itbis: 0,
        descuento: 0,
      } satisfies FacturaGroup)

    group.rows.push(factura)
    group.total += factura.total_neto || 0
    group.itbis += factura.impuesto || 0
    group.descuento += factura.descuento || 0
    groups.set(ncfTipo, group)
  }

  return [...groups.values()].sort((a, b) =>
    a.ncfTipo.localeCompare(b.ncfTipo, 'es')
  )
}

async function fetchCuadreDia(
  noCia: string,
  punto: string,
  fecha: string,
  incluirDetalle: boolean
): Promise<CuadreResp> {
  const p = new URLSearchParams({ no_cia: noCia, punto })
  if (fecha) p.set('fecha', fecha)
  if (incluirDetalle) p.set('incluir_detalle', '1')

  const res = await fetch(`${API}/fat/reportes/cuadre-caja/print-data/?${p}`, {
    credentials: 'include',
  })

  if (!res.ok) throw new Error(await res.text())

  const json = await res.json()
  const e = json.extra || {}

  return {
    fecha: e.fecha || fecha,
    fecha_solicitada: e.fecha_solicitada || '',
    dia_en_progreso: !!e.dia_en_progreso,
    usuario: e.usuario || '',
    no_cuadre: Number(e.no_cuadre || 0),
    resumen_ventas: e.resumen_ventas || [],
    resumen_pago: e.resumen_pago || [],
    por_ncf_forma_pago: e.por_ncf_forma_pago || [],
    facturas: e.facturas || [],
  }
}

export function CuadreCajaFat({ noCia, punto }: Props) {
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
  const resumenVentas = data?.resumen_ventas ?? []
  const porNcfFormaPago = data?.por_ncf_forma_pago ?? []
  const facturas = incluirDetalle ? (data?.facturas ?? []) : []
  const facturasPorNcf = groupFacturasPorNcf(facturas)

  const resumenSorted = [...resumen].sort((a, b) => {
    const aCredit = (a.tipo_pago || '').startsWith('C')
    const bCredit = (b.tipo_pago || '').startsWith('C')
    if (aCredit !== bCredit) return aCredit ? 1 : -1
    return (a.forma_pago || '').localeCompare(b.forma_pago || '', 'es')
  })

  const totalFormaPago = resumen.reduce((s, r) => s + (r.total || 0), 0)
  const totalVentas = resumenVentas.reduce((s, r) => s + (r.total || 0), 0)
  const totalFacturas = facturas.reduce((s, f) => s + (f.total_neto || 0), 0)

  const ncfFormaPagoMatrix = (() => {
    const formasSet = new Set<string>()
    const filaMap = new Map<
      string,
      {
        ncf_tipo: string
        total: number
        porForma: Record<string, { cantidad: number; total: number }>
      }
    >()

    for (const r of porNcfFormaPago) {
      const ncfTipo = (r.ncf_tipo || 'SIN NCF').trim().toUpperCase()
      const formaPago = r.forma_pago || 'Sin forma de pago'

      formasSet.add(formaPago)

      let fila = filaMap.get(ncfTipo)
      if (!fila) {
        fila = { ncf_tipo: ncfTipo, total: 0, porForma: {} }
        filaMap.set(ncfTipo, fila)
      }

      fila.porForma[formaPago] = {
        cantidad: r.cantidad,
        total: r.total,
      }
      fila.total += r.total || 0
    }

    const formas = [...formasSet].sort((a, b) => a.localeCompare(b, 'es'))
    const filas = [...filaMap.values()].sort((a, b) =>
      a.ncf_tipo.localeCompare(b.ncf_tipo, 'es')
    )
    const totalesCol: Record<string, number> = {}

    for (const forma of formas) {
      totalesCol[forma] = filas.reduce(
        (s, fila) => s + (fila.porForma[forma]?.total ?? 0),
        0
      )
    }

    const totalMatrix = filas.reduce((s, fila) => s + fila.total, 0)
    return { formas, filas, totalesCol, totalMatrix }
  })()

  const mesAno = (() => {
    const d = new Date(fecha || TODAY)
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
  })()

  const exportCsv = async () => {
    if (!resumen.length) return

    const meta = await buildReportMeta(noCia, punto, mesAno)
    const rows: (string | number | null | undefined)[][] = []

    rows.push([
      `=== Cuadre de Caja del ${fecha} ${data?.usuario ? ' - ' + data.usuario : ''} ===`,
    ])
    rows.push([])
    rows.push(['=== Ventas del Dia ==='])
    rows.push(['Tipo', 'Descripcion', 'Cantidad', 'Total RD'])
    for (const it of resumenVentas) {
      rows.push([
        it.clase,
        it.descripcion,
        it.cantidad,
        Number(it.total ?? 0).toFixed(2),
      ])
    }
    rows.push(['', '', 'TOTAL VENTAS', totalVentas.toFixed(2)])
    rows.push([])
    rows.push(['=== Resumen por Forma de Pago ==='])
    rows.push(['Tipo', 'Descripcion', 'Cantidad', 'Total RD'])

    for (const it of resumenSorted) {
      rows.push([
        it.tipo_pago,
        it.forma_pago,
        it.cantidad,
        Number(it.total ?? 0).toFixed(2),
      ])
    }

    rows.push(['', '', 'TOTAL', totalFormaPago.toFixed(2)])

    if (incluirDetalle && facturasPorNcf.length) {
      rows.push([])
      rows.push(['=== Detalle por NCF ==='])
      rows.push([
        'NCF',
        'No. Factura',
        'Cliente',
        'Forma Pago',
        'Descuento',
        'ITBIS',
        'Total Neto',
        'Anulada',
        'Motivo Anulacion',
      ])

      for (const group of facturasPorNcf) {
        rows.push([`=== ${group.ncfTipo} - ${labelNcf(group.ncfTipo)} ===`])

        for (const f of group.rows) {
          rows.push([
            group.ncfTipo,
            `${f.tipo_factura}-${f.no_factura}`,
            f.nombre_cliente,
            f.forma_pago,
            (f.descuento || 0).toFixed(2),
            (f.impuesto || 0).toFixed(2),
            (f.total_neto || 0).toFixed(2),
            f.st_anulado === 'S' ? 'SI' : '',
            f.st_anulado === 'S' ? (f.motivo_anulacion || '') : '',
          ])
        }
      }
    }

    downloadCsv(`cuadre-caja-${fecha}.csv`, [], rows, meta)
  }

  const abrirPdf = () => {
    const u = new URLSearchParams({ no_cia: noCia, punto })
    if (incluirDetalle) u.set('incluir_detalle', '1')

    window.open(
      `/print/cuadre-caja/${encodeURIComponent(fecha)}?${u.toString()}`,
      '_blank',
      'noopener'
    )
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='flex items-center gap-2 text-lg font-semibold'>
            <Calculator className='h-5 w-5' /> Cuadre de Caja
          </h2>
          <p className='flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground'>
            <span>
              Empresa {noCia} / Punto {punto}
            </span>
            {data?.fecha && <span>- {data.fecha}</span>}
            {data?.no_cuadre ? (
              <span className='rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700'>
                Cuadrado #{data.no_cuadre}
              </span>
            ) : data?.dia_en_progreso ? (
              <span className='rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800'>
                Dia en progreso
              </span>
            ) : null}
            {data?.usuario && <span>- {data.usuario}</span>}
          </p>
        </div>

        <div className='flex flex-wrap gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={abrirPdf}
            disabled={!resumen.length}
          >
            <Printer className='mr-1 h-4 w-4' /> Imprimir PDF
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={exportCsv}
            disabled={!resumen.length}
          >
            <FileSpreadsheet className='mr-1 h-4 w-4' /> Excel
          </Button>
          <Button variant='outline' size='sm' onClick={() => q.refetch()}>
            <RefreshCw className='mr-1 h-4 w-4' /> Actualizar
          </Button>
        </div>
      </div>

      <div className='flex flex-wrap items-end gap-4 rounded-md border bg-muted/30 p-3'>
        <div className='space-y-1'>
          <Label
            htmlFor='cuadre-fecha'
            className='text-xs text-muted-foreground'
          >
            Fecha del cuadre
          </Label>
          <Input
            id='cuadre-fecha'
            type='date'
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className='h-9 w-44'
          />
        </div>

        <div className='flex items-center gap-2 pb-1'>
          <Switch
            id='inc-det'
            checked={incluirDetalle}
            onCheckedChange={(v) => setIncluirDetalle(!!v)}
          />
          <Label htmlFor='inc-det' className='cursor-pointer text-sm'>
            Mostrar detalle en NCF y PDF
          </Label>
        </div>

        <div className='pb-1 text-xs font-medium text-muted-foreground'>
          Detalle PDF: {incluirDetalle ? 'Si' : 'No'}
        </div>

        {q.isFetching && (
          <span className='pb-2 text-xs text-muted-foreground'>
            Cargando...
          </span>
        )}
        {q.error && (
          <span className='pb-2 text-xs text-red-600'>
            Error al cargar el cuadre.
          </span>
        )}
      </div>

      <div className='space-y-4'>
        <div className='rounded-md border'>
          <div className='border-b bg-muted/40 px-3 py-2 text-sm font-semibold text-blue-700'>
            Ventas del Dia / Agrupado por Forma de Pago
          </div>
          <div className='grid gap-2 border-b bg-background p-3 md:grid-cols-3'>
            {resumenVentas.map((it) => (
              <div key={it.clase} className='rounded border bg-muted/20 p-2'>
                <div className='text-xs font-medium text-muted-foreground'>
                  {it.descripcion}
                </div>
                <div className='mt-1 font-mono text-lg font-semibold tabular-nums'>
                  {fmtN(it.total)}
                </div>
                <div className='text-xs text-muted-foreground'>
                  {it.cantidad} {it.cantidad === 1 ? 'factura' : 'facturas'}
                </div>
              </div>
            ))}
            <div className='rounded border bg-muted/30 p-2'>
              <div className='text-xs font-medium text-muted-foreground'>
                Total ventas del dia
              </div>
              <div className='mt-1 font-mono text-lg font-semibold tabular-nums'>
                {fmtN(totalVentas)}
              </div>
              <div className='text-xs text-muted-foreground'>
                El credito no suma como ingreso cobrado.
              </div>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-32'>Tipo</TableHead>
                <TableHead>Descripcion</TableHead>
                <TableHead className='w-20 text-right'>Cant.</TableHead>
                <TableHead className='w-32 text-right'>Total RD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className='py-8 text-center text-muted-foreground'
                  >
                    Cargando cuadre del dia...
                  </TableCell>
                </TableRow>
              )}

              {!q.isLoading && resumenSorted.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className='py-8 text-center text-muted-foreground'
                  >
                    Sin movimientos para el {fecha}.
                  </TableCell>
                </TableRow>
              )}

              {resumenSorted.map((it) => (
                <TableRow key={`${it.tipo_pago}-${it.forma_pago}`}>
                  <TableCell className='font-mono text-sm'>
                    {it.tipo_pago}
                  </TableCell>
                  <TableCell className='text-sm'>{it.forma_pago}</TableCell>
                  <TableCell className='text-right font-mono'>
                    {it.cantidad}
                  </TableCell>
                  <TableCell className='text-right font-mono tabular-nums'>
                    {fmtN(it.total)}
                  </TableCell>
                </TableRow>
              ))}

              {resumenSorted.length > 0 && (
                <TableRow className='border-t-2 bg-muted/40 font-bold'>
                  <TableCell colSpan={3} className='text-right'>
                    Total Ingresos
                  </TableCell>
                  <TableCell className='text-right font-mono tabular-nums'>
                    {fmtN(totalFormaPago)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className='rounded-md border'>
          <div className='flex items-center justify-between gap-3 border-b bg-muted/40 px-3 py-2 text-sm font-semibold text-blue-700'>
            <span>Agrupado por NCF</span>
            <span className='text-xs font-normal text-muted-foreground'>
              {incluirDetalle ? 'Detalle visible y en PDF' : 'Detalle oculto'}
            </span>
          </div>

          {q.isLoading ? (
            <div className='py-8 text-center text-sm text-muted-foreground'>
              Cargando agrupado por NCF...
            </div>
          ) : ncfFormaPagoMatrix.filas.length === 0 ? (
            <div className='py-8 text-center text-sm text-muted-foreground'>
              Sin facturas con NCF para el {fecha}.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-16'>NCF</TableHead>
                  <TableHead>Descripcion</TableHead>
                  {ncfFormaPagoMatrix.formas.map((forma) => (
                    <TableHead key={forma} className='text-right'>
                      {forma}
                    </TableHead>
                  ))}
                  <TableHead className='text-right'>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ncfFormaPagoMatrix.filas.map((fila) => (
                  <TableRow key={fila.ncf_tipo}>
                    <TableCell className='font-mono font-semibold'>
                      {fila.ncf_tipo || 'SIN NCF'}
                    </TableCell>
                    <TableCell className='text-sm'>
                      {labelNcf(fila.ncf_tipo)}
                    </TableCell>
                    {ncfFormaPagoMatrix.formas.map((forma) => {
                      const v = fila.porForma[forma]?.total ?? 0
                      return (
                        <TableCell
                          key={forma}
                          className='text-right font-mono tabular-nums'
                        >
                          {v ? (
                            fmtN(v)
                          ) : (
                            <span className='text-muted-foreground/50'>-</span>
                          )}
                        </TableCell>
                      )
                    })}
                    <TableCell className='text-right font-mono font-semibold tabular-nums'>
                      {fmtN(fila.total)}
                    </TableCell>
                  </TableRow>
                ))}

                <TableRow className='border-t-2 bg-muted/40 font-bold'>
                  <TableCell colSpan={2} className='text-right'>
                    TOTAL
                  </TableCell>
                  {ncfFormaPagoMatrix.formas.map((forma) => (
                    <TableCell
                      key={forma}
                      className='text-right font-mono tabular-nums'
                    >
                      {fmtN(ncfFormaPagoMatrix.totalesCol[forma] ?? 0)}
                    </TableCell>
                  ))}
                  <TableCell className='text-right font-mono tabular-nums'>
                    {fmtN(ncfFormaPagoMatrix.totalMatrix)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}

          {incluirDetalle && (
            <div className='border-t'>
              <div className='px-3 py-2 text-sm font-semibold'>
                Detalle de facturas ({facturas.length})
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
                  {q.isFetching && facturas.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className='py-8 text-center text-muted-foreground'
                      >
                        Cargando detalle de facturas...
                      </TableCell>
                    </TableRow>
                  )}

                  {!q.isFetching && facturasPorNcf.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className='py-8 text-center text-muted-foreground'
                      >
                        Sin facturas para detallar.
                      </TableCell>
                    </TableRow>
                  )}

                  {facturasPorNcf.map((group) => (
                    <Fragment key={group.ncfTipo}>
                      <TableRow className='bg-muted/30'>
                        <TableCell
                          colSpan={7}
                          className='py-1.5 text-sm font-semibold'
                        >
                          {group.ncfTipo} - {labelNcf(group.ncfTipo)}
                          <span className='ml-2 text-xs font-normal text-muted-foreground'>
                            ({group.rows.length}{' '}
                            {group.rows.length === 1 ? 'factura' : 'facturas'})
                          </span>
                        </TableCell>
                      </TableRow>

                      {group.rows.map((f, i) => {
                        const anulada = f.st_anulado === 'S'

                        return (
                          <Fragment
                            key={`${group.ncfTipo}-${f.tipo_factura}-${f.no_factura}-${i}`}
                          >
                            <TableRow className={anulada ? 'text-red-600' : ''}>
                              <TableCell className='pl-6 font-mono text-sm'>
                                {f.tipo_factura}-{f.no_factura}
                                {anulada && (
                                  <span className='ml-1 text-xs'>(ANUL)</span>
                                )}
                              </TableCell>
                              <TableCell className='text-sm'>
                                {(f.nombre_cliente || '').slice(0, 60)}
                              </TableCell>
                              <TableCell className='font-mono text-xs'>
                                {f.ncf_dgi || '-'}
                              </TableCell>
                              <TableCell className='text-xs'>
                                {f.forma_pago}
                              </TableCell>
                              <TableCell className='text-right font-mono tabular-nums'>
                                {fmtN(f.descuento || 0)}
                              </TableCell>
                              <TableCell className='text-right font-mono tabular-nums'>
                                {fmtN(f.impuesto || 0)}
                              </TableCell>
                              <TableCell className='text-right font-mono font-semibold tabular-nums'>
                                {fmtN(f.total_neto || 0)}
                              </TableCell>
                            </TableRow>
                            {anulada && f.motivo_anulacion && (
                              <TableRow className='text-red-600'>
                                <TableCell
                                  colSpan={7}
                                  className='pl-6 pt-0 pb-1.5 text-xs italic'
                                >
                                  Motivo: {f.motivo_anulacion}
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        )
                      })}

                      <TableRow className='bg-muted/20 font-semibold'>
                        <TableCell colSpan={4} className='pr-3 text-right'>
                          Subtotal {group.ncfTipo}
                        </TableCell>
                        <TableCell className='text-right font-mono tabular-nums'>
                          {fmtN(group.descuento)}
                        </TableCell>
                        <TableCell className='text-right font-mono tabular-nums'>
                          {fmtN(group.itbis)}
                        </TableCell>
                        <TableCell className='text-right font-mono tabular-nums'>
                          {fmtN(group.total)}
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  ))}

                  {facturas.length > 0 && (
                    <TableRow className='border-t-2 bg-muted/40 font-bold'>
                      <TableCell colSpan={6} className='text-right'>
                        TOTAL ({facturas.length} facturas)
                      </TableCell>
                      <TableCell className='text-right font-mono tabular-nums'>
                        {fmtN(totalFacturas)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
