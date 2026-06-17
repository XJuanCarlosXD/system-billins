import { Fragment, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Banknote, Calculator, ChevronDown, ChevronRight,
  CreditCard, FileSpreadsheet, Printer, RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props { noCia: string; punto: string; mes?: number; ano?: number }

type ResumenItem = { tipo_pago: string; forma_pago: string; cantidad: number; total: number }
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
  fecha_solicitada: string
  dia_en_progreso: boolean
  usuario: string
  no_cuadre: number
  resumen_pago: ResumenItem[]
  por_ncf_forma_pago: NcfFormaPagoItem[]
  facturas: FacturaItem[]
}

const API = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

const fmtN = (n: number) =>
  Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// tipo_pago empezando con 'C' = crédito (no entra plata hoy, queda en CxC).
const esCredito = (tipo_pago: string) => (tipo_pago || '').toUpperCase().startsWith('C')

function labelNcf(ncf_tipo: string): string {
  const t = (ncf_tipo || '').toUpperCase()
  const map: Record<string, string> = {
    'B01': 'B01 — Crédito Fiscal', 'B02': 'B02 — Consumo',
    'B03': 'B03 — Nota de Débito', 'B04': 'B04 — Nota de Crédito',
    'B11': 'B11 — Proveedor Informal', 'B12': 'B12 — Registro Único',
    'B13': 'B13 — Gastos Menores', 'B14': 'B14 — Régimen Especial',
    'B15': 'B15 — Gubernamental', 'B16': 'B16 — Exportación',
  }
  return map[t] || (t || '—')
}

// fecha vacía = el backend usa SYSDATE (hoy en Oracle).
async function fetchCuadreDia(noCia: string, punto: string, fecha: string,
                              incluirDetalle: boolean): Promise<CuadreResp> {
  const p = new URLSearchParams({ no_cia: noCia, punto })
  if (fecha) p.set('fecha', fecha)
  if (incluirDetalle) p.set('incluir_detalle', '1')
  const res = await fetch(`${API}/fat/reportes/cuadre-caja/print-data/?${p}`,
    { credentials: 'include' })
  if (!res.ok) throw new Error(await res.text())
  const json = await res.json()
  const e = json.extra || {}
  return {
    fecha: e.fecha || fecha,
    fecha_solicitada: e.fecha_solicitada || '',
    dia_en_progreso: !!e.dia_en_progreso,
    usuario: e.usuario || '',
    no_cuadre: Number(e.no_cuadre || 0),
    resumen_pago: e.resumen_pago || [],
    por_ncf_forma_pago: e.por_ncf_forma_pago || [],
    facturas: e.facturas || [],
  }
}

const TODAY = new Date().toISOString().slice(0, 10)

// Indexa facturas por forma_pago para que cada fila del resumen muestre
// SUS facturas al expandir.
function groupFacturasPorFormaPago(facturas: FacturaItem[]): Record<string, FacturaItem[]> {
  const out: Record<string, FacturaItem[]> = {}
  for (const f of facturas) {
    const key = (f.forma_pago || '').toUpperCase().trim()
    if (!key) continue
    ;(out[key] = out[key] || []).push(f)
  }
  return out
}

export function CuadreCajaFat({ noCia, punto }: Props) {
  // Default = HOY (sysdate). El cuadre del día se hala automáticamente al
  // entrar. Si hoy no tiene facturas, sale "Día en progreso" con sin
  // movimientos — eso es lo correcto contra el legacy.
  const [fecha, setFecha] = useState(TODAY)
  const [incluirDetalle, setIncluirDetalle] = useState(false)
  const [showNcfDetail, setShowNcfDetail] = useState(false)
  const [expandida, setExpandida] = useState<Record<string, boolean>>({})
  // Por cada forma de pago, si su detalle de facturas sale en el PDF.
  // Default: todas en true cuando aparece la forma de pago la primera vez.
  const [pdfForma, setPdfForma] = useState<Record<string, boolean>>({})
  // Cobros a crédito recibidos hoy por transferencia (no vienen del FAT del
  // día — son cobros de CxC). El cajero los anota manualmente para que
  // queden trazados en el cuadre.
  const [cobrosCredTransfer, setCobrosCredTransfer] = useState<string>('')

  const q = useQuery({
    queryKey: ['fat-cuadre-dia', noCia, punto, fecha, incluirDetalle],
    queryFn: () => fetchCuadreDia(noCia, punto, fecha, incluirDetalle),
    enabled: !!noCia && !!fecha,
    staleTime: 60_000,
  })

  // Para poder expandir formas de pago necesitamos las facturas: forzamos
  // que el backend siempre las devuelva. El switch "incluir detalle" sigue
  // controlando si salen en el PDF.
  const qDet = useQuery({
    queryKey: ['fat-cuadre-dia-det', noCia, punto, fecha],
    queryFn: () => fetchCuadreDia(noCia, punto, fecha, true),
    enabled: !!noCia && !!fecha,
    staleTime: 60_000,
  })

  const data = q.data
  // Sincroniza el input si el backend devolvió una fecha distinta (ej. clamp).
  useEffect(() => {
    if (data?.fecha && data.fecha !== fecha) setFecha(data.fecha)
  }, [data?.fecha])  // eslint-disable-line react-hooks/exhaustive-deps

  const resumen = data?.resumen_pago ?? []
  const porNcfFormaPago = data?.por_ncf_forma_pago ?? []
  const facturas = qDet.data?.facturas ?? []

  // Cobros de crédito al final, resto alfabético por forma_pago.
  const resumenSorted = useMemo(() => [...resumen].sort((a, b) => {
    const aCredit = esCredito(a.tipo_pago)
    const bCredit = esCredito(b.tipo_pago)
    if (aCredit !== bCredit) return aCredit ? 1 : -1
    return (a.forma_pago || '').localeCompare(b.forma_pago || '', 'es')
  }), [resumen])

  // Separación contado (entró plata hoy) vs crédito (queda pendiente en CxC).
  const ventasContado = resumenSorted.filter(r => !esCredito(r.tipo_pago))
  const ventasCredito = resumenSorted.filter(r => esCredito(r.tipo_pago))
  const totalContado = ventasContado.reduce((s, r) => s + r.total, 0)
  const totalCredito = ventasCredito.reduce((s, r) => s + r.total, 0)
  const totalVentas = totalContado + totalCredito
  const cobrosCredTransferNum = Number((cobrosCredTransfer || '0').replace(',', '.')) || 0
  const totalCobrosDia = totalContado + cobrosCredTransferNum
  const totalFacturas = facturas.reduce((s, f) => s + (f.total_neto || 0), 0)

  // Cuando aparece una forma de pago nueva, default = true (sale en el PDF).
  useEffect(() => {
    setPdfForma(prev => {
      let changed = false
      const next = { ...prev }
      for (const r of ventasContado) {
        const key = r.forma_pago.toUpperCase()
        if (!(key in next)) { next[key] = true; changed = true }
      }
      return changed ? next : prev
    })
  }, [ventasContado.length])  // eslint-disable-line react-hooks/exhaustive-deps

  // Matriz NCF × forma_pago.
  const ncfFormaPagoMatrix = useMemo(() => {
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
  }, [porNcfFormaPago])

  // Facturas indexadas por forma de pago (para expandir filas del resumen).
  const facturasPorFormaPago = useMemo(
    () => groupFacturasPorFormaPago(facturas), [facturas])

  const mesAno = (() => {
    const d = new Date(fecha || TODAY)
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
  })()

  // Formas seleccionadas para que su detalle salga en el PDF (CSV).
  const formasParaPdf = ventasContado
    .filter(r => pdfForma[r.forma_pago.toUpperCase()] !== false)
    .map(r => r.forma_pago.toUpperCase())

  const exportCsv = async () => {
    if (!resumen.length) return
    const meta = await buildReportMeta(noCia, punto, mesAno)
    const rows: any[][] = []
    rows.push([`=== Cuadre de Caja del ${fecha} ${data?.usuario ? '· ' + data.usuario : ''} ===`])
    rows.push([])

    rows.push(['=== Ventas del Día ==='])
    rows.push(['Concepto', 'Total RD'])
    rows.push(['Ventas en efectivo / cobradas hoy', totalContado.toFixed(2)])
    rows.push(['Ventas a crédito del día (pendiente CxC)', totalCredito.toFixed(2)])
    rows.push(['TOTAL VENTAS', totalVentas.toFixed(2)])
    rows.push([])

    rows.push(['=== Cobros del Día por Forma de Pago ==='])
    rows.push(['Tipo', 'Descripcion', 'Cantidad', 'Total RD', 'En PDF'])
    for (const it of ventasContado) {
      const key = it.forma_pago.toUpperCase()
      rows.push([it.tipo_pago, it.forma_pago, it.cantidad, Number(it.total ?? 0).toFixed(2),
                 pdfForma[key] === false ? 'NO' : 'SI'])
    }
    if (cobrosCredTransferNum > 0) {
      rows.push(['', 'COBROS CRED. TRANSFERENCIA (manual)', '', cobrosCredTransferNum.toFixed(2), 'SI'])
    }
    rows.push(['', '', 'TOTAL COBROS DEL DÍA', totalCobrosDia.toFixed(2), ''])

    if (ventasCredito.length) {
      rows.push([])
      rows.push(['=== Facturación a Crédito (no entró plata hoy) ==='])
      rows.push(['Tipo', 'Descripcion', 'Cantidad', 'Total RD'])
      for (const it of ventasCredito) {
        rows.push([it.tipo_pago, it.forma_pago, it.cantidad, Number(it.total ?? 0).toFixed(2)])
      }
      rows.push(['', '', 'TOTAL CRÉDITO', totalCredito.toFixed(2)])
    }

    if (incluirDetalle && facturas.length) {
      rows.push([])
      rows.push(['=== Detalle por Forma de Pago ==='])
      rows.push(['Forma Pago', 'No. Factura', 'Cliente', 'NCF', 'Descuento', 'ITBIS', 'Total Neto', 'Anulada'])
      for (const it of ventasContado) {
        const key = it.forma_pago.toUpperCase()
        if (pdfForma[key] === false) continue
        const list = facturasPorFormaPago[key] || []
        if (!list.length) continue
        rows.push([`=== ${it.forma_pago} ===`])
        for (const f of list) {
          rows.push([
            it.forma_pago,
            `${f.tipo_factura}-${f.no_factura}`,
            f.nombre_cliente, f.ncf_dgi,
            (f.descuento || 0).toFixed(2), (f.impuesto || 0).toFixed(2),
            (f.total_neto || 0).toFixed(2),
            f.st_anulado === 'S' ? 'SI' : '',
          ])
        }
      }
    }
    downloadCsv(`cuadre-caja-${fecha}.csv`, [], rows, meta)
  }

  // Abre el PDF nuevo (Puck + logo). El query string lleva:
  //   incluir_detalle    — el switch general
  //   show_ncf_detail    — el switch "Ver detalle de NCF"
  //   formas_pago_pdf    — formas seleccionadas para que su detalle salga
  //   cobros_cred_transfer — monto manual de cobros a crédito por transferencia
  const abrirPdf = () => {
    const u = new URLSearchParams({ no_cia: noCia, punto })
    if (incluirDetalle) u.set('incluir_detalle', '1')
    if (showNcfDetail) u.set('show_ncf_detail', '1')
    if (formasParaPdf.length) u.set('formas_pago_pdf', formasParaPdf.join(','))
    if (cobrosCredTransferNum > 0) u.set('cobros_cred_transfer', cobrosCredTransferNum.toFixed(2))
    window.open(
      `/print/cuadre-caja/${encodeURIComponent(fecha)}?${u.toString()}`,
      '_blank', 'noopener')
  }

  const toggleRow = (key: string) =>
    setExpandida((p) => ({ ...p, [key]: !p[key] }))

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <Calculator className='h-5 w-5' /> Cuadre de Caja
          </h2>
          <p className='text-sm text-muted-foreground flex flex-wrap items-center gap-x-2'>
            <span>Empresa {noCia} / Punto {punto}</span>
            {data?.fecha && <span>· {data.fecha}</span>}
            {data?.no_cuadre ? (
              <span className='rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700'>
                Cuadrado #{data.no_cuadre}
              </span>
            ) : data?.dia_en_progreso ? (
              <span className='rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800'>
                Día en progreso
              </span>
            ) : null}
            {data?.usuario && <span>· {data.usuario}</span>}
          </p>
        </div>
        <div className='flex gap-2 flex-wrap'>
          <Button variant='outline' size='sm' onClick={abrirPdf}
                  disabled={!resumen.length}>
            <Printer className='mr-1 h-4 w-4' /> Imprimir PDF
          </Button>
          <Button variant='outline' size='sm' onClick={exportCsv}
                  disabled={!resumen.length}>
            <FileSpreadsheet className='mr-1 h-4 w-4' /> Excel
          </Button>
          <Button variant='outline' size='sm' onClick={() => { q.refetch(); qDet.refetch() }}>
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
            Incluir detalle de facturas en el PDF
          </Label>
        </div>
        <div className='flex items-center gap-2 pb-1'>
          <Switch id='show-ncf' checked={showNcfDetail}
                  onCheckedChange={(v) => setShowNcfDetail(!!v)} />
          <Label htmlFor='show-ncf' className='cursor-pointer text-sm'>
            Ver detalle de NCF
          </Label>
        </div>
        {(q.isFetching || qDet.isFetching) && (
          <span className='text-xs text-muted-foreground pb-2'>Cargando…</span>
        )}
        {(q.error || qDet.error) && (
          <span className='text-xs text-red-600 pb-2'>Error al cargar el cuadre.</span>
        )}
      </div>

      <div className='space-y-4'>
        {/* Card 1 — Ventas del Día (sugerencia Roberto/Angel) */}
        <div className='rounded-md border'>
          <div className='px-3 py-2 border-b bg-muted/40 text-sm font-semibold text-blue-700 flex items-center gap-2'>
            <Banknote className='h-4 w-4' /> Ventas del Día
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Concepto</TableHead>
                <TableHead className='w-32 text-right'>Total RD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  <span className='font-medium'>Ventas en efectivo / cobradas hoy</span>
                  <span className='ml-2 text-xs text-muted-foreground'>
                    (entró plata: efectivo, transferencia, cheque, tarjeta)
                  </span>
                </TableCell>
                <TableCell className='text-right font-mono tabular-nums'>{fmtN(totalContado)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <span className='font-medium'>Ventas a crédito del día</span>
                  <span className='ml-2 text-xs text-muted-foreground'>
                    (pendiente de cobro — queda en CxC)
                  </span>
                </TableCell>
                <TableCell className='text-right font-mono tabular-nums'>{fmtN(totalCredito)}</TableCell>
              </TableRow>
              <TableRow className='border-t-2 bg-muted/40 font-bold'>
                <TableCell className='text-right'>Total Ventas del Día</TableCell>
                <TableCell className='text-right font-mono tabular-nums'>{fmtN(totalVentas)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Card 2 — Cobros del Día por Forma de Pago, con expand + check PDF */}
        <div className='rounded-md border'>
          <div className='px-3 py-2 border-b bg-muted/40 text-sm font-semibold text-blue-700 flex items-center gap-2'>
            <CreditCard className='h-4 w-4' /> Cobros del Día por Forma de Pago
            <span className='ml-auto text-xs font-normal text-muted-foreground'>
              Marca el check para incluir el detalle de la forma en el PDF
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-8'></TableHead>
                <TableHead className='w-20'>Tipo</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className='w-20 text-right'>Cant.</TableHead>
                <TableHead className='w-32 text-right'>Total RD</TableHead>
                <TableHead className='w-20 text-center'>En PDF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading && (
                <TableRow><TableCell colSpan={6} className='py-8 text-center text-muted-foreground'>Cargando cuadre del día…</TableCell></TableRow>
              )}
              {!q.isLoading && ventasContado.length === 0 && cobrosCredTransferNum === 0 && (
                <TableRow><TableCell colSpan={6} className='py-8 text-center text-muted-foreground'>Sin cobros para el {fecha}.</TableCell></TableRow>
              )}
              {ventasContado.map(it => {
                const key = it.forma_pago.toUpperCase()
                const list = facturasPorFormaPago[key] || []
                const open = !!expandida[key]
                const hasDet = list.length > 0
                const enPdf = pdfForma[key] !== false
                return (
                  <Fragment key={`${it.tipo_pago}-${it.forma_pago}`}>
                    <TableRow className={hasDet ? 'hover:bg-muted/40' : 'opacity-95'}>
                      <TableCell
                        className={hasDet ? 'py-1.5 cursor-pointer' : 'py-1.5'}
                        onClick={hasDet ? () => toggleRow(key) : undefined}
                      >
                        {hasDet ? (
                          open ? <ChevronDown className='h-4 w-4' /> : <ChevronRight className='h-4 w-4' />
                        ) : null}
                      </TableCell>
                      <TableCell
                        className={hasDet ? 'font-mono text-sm cursor-pointer' : 'font-mono text-sm'}
                        onClick={hasDet ? () => toggleRow(key) : undefined}
                      >{it.tipo_pago}</TableCell>
                      <TableCell
                        className={hasDet ? 'text-sm cursor-pointer' : 'text-sm'}
                        onClick={hasDet ? () => toggleRow(key) : undefined}
                      >{it.forma_pago}</TableCell>
                      <TableCell className='text-right font-mono'>{it.cantidad}</TableCell>
                      <TableCell className='text-right font-mono tabular-nums'>{fmtN(it.total)}</TableCell>
                      <TableCell className='text-center'>
                        <Checkbox
                          checked={enPdf}
                          onCheckedChange={(v) =>
                            setPdfForma(p => ({ ...p, [key]: !!v }))
                          }
                          aria-label={`Incluir ${it.forma_pago} en PDF`}
                        />
                      </TableCell>
                    </TableRow>
                    {open && hasDet && (
                      <TableRow className='bg-blue-50/40'>
                        <TableCell></TableCell>
                        <TableCell colSpan={5} className='p-0'>
                          <FacturasSubTabla rows={list} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}

              {/* Casilla manual COBROS CRED. TRANSFERENCIA (sugerencia Angel) */}
              <TableRow className='bg-amber-50/50'>
                <TableCell></TableCell>
                <TableCell className='font-mono text-sm'>—</TableCell>
                <TableCell className='text-sm'>
                  <span className='font-medium'>COBROS CRED. TRANSFERENCIA</span>
                  <span className='ml-2 text-xs text-muted-foreground'>
                    (cobros a crédito recibidos hoy por transferencia)
                  </span>
                </TableCell>
                <TableCell className='text-right font-mono text-muted-foreground'>—</TableCell>
                <TableCell className='text-right'>
                  <Input
                    type='number' step='0.01' min='0' placeholder='0.00'
                    value={cobrosCredTransfer}
                    onChange={(e) => setCobrosCredTransfer(e.target.value)}
                    className='h-7 w-28 text-right font-mono tabular-nums ml-auto'
                  />
                </TableCell>
                <TableCell className='text-center'>
                  <Checkbox checked={cobrosCredTransferNum > 0} disabled aria-label='Manual' />
                </TableCell>
              </TableRow>

              {(ventasContado.length > 0 || cobrosCredTransferNum > 0) && (
                <TableRow className='border-t-2 bg-muted/40 font-bold'>
                  <TableCell colSpan={4} className='text-right'>Total Cobros del Día</TableCell>
                  <TableCell className='text-right font-mono tabular-nums'>{fmtN(totalCobrosDia)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Card 3 — Facturación a crédito del día (informativo, no entró plata) */}
        {ventasCredito.length > 0 && (
          <div className='rounded-md border'>
            <div className='px-3 py-2 border-b bg-muted/40 text-sm font-semibold text-blue-700'>
              Facturación a Crédito (no entró plata — pendiente CxC)
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-20'>Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className='w-20 text-right'>Cant.</TableHead>
                  <TableHead className='w-32 text-right'>Total RD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventasCredito.map(it => (
                  <TableRow key={`cr-${it.tipo_pago}-${it.forma_pago}`}>
                    <TableCell className='font-mono text-sm'>{it.tipo_pago}</TableCell>
                    <TableCell className='text-sm'>{it.forma_pago}</TableCell>
                    <TableCell className='text-right font-mono'>{it.cantidad}</TableCell>
                    <TableCell className='text-right font-mono tabular-nums'>{fmtN(it.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className='border-t-2 bg-muted/40 font-bold'>
                  <TableCell colSpan={3} className='text-right'>Total Crédito</TableCell>
                  <TableCell className='text-right font-mono tabular-nums'>{fmtN(totalCredito)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}

        {/* Card 4 — NCF × Forma de Pago (solo visible cuando el switch está prendido) */}
        {showNcfDetail && ncfFormaPagoMatrix.formas.length > 0 && (
          <div className='rounded-md border'>
            <div className='px-3 py-2 border-b bg-muted/40 text-sm font-semibold text-blue-700 flex items-center justify-between'>
              <span>Cuadre de Caja por NCF · matriz NCF × Forma de Pago</span>
              <span className='text-xs font-normal text-muted-foreground'>
                Saldrá en el PDF
              </span>
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

        {/* Card 5 — Detalle de Facturas del Día, agrupado por forma de pago.
            Independiente del switch "Incluir detalle en el PDF" — aquí
            siempre se muestra en pantalla si hay facturas. */}
        {facturas.length > 0 && (
          <div className='rounded-md border'>
            <div className='px-3 py-2 border-b bg-muted/40 text-sm font-semibold text-blue-700 flex items-center justify-between'>
              <span>Detalle de Facturas del Día ({facturas.length}) · agrupado por Forma de Pago</span>
              <span className='text-xs font-normal text-muted-foreground'>
                {incluirDetalle ? 'Saldrá en el PDF' : 'No saldrá en el PDF'}
              </span>
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
                {ventasContado.map((it) => {
                  const key = it.forma_pago.toUpperCase()
                  const list = facturasPorFormaPago[key] || []
                  if (!list.length) return null
                  const sub = list.reduce(
                    (s, f) => ({
                      total: s.total + (f.total_neto || 0),
                      itbis: s.itbis + (f.impuesto || 0),
                      desc: s.desc + (f.descuento || 0),
                    }),
                    { total: 0, itbis: 0, desc: 0 },
                  )
                  return (
                    <Fragment key={`det-${key}`}>
                      <TableRow className='bg-muted/30'>
                        <TableCell colSpan={7} className='py-1.5 font-semibold text-sm'>
                          {it.forma_pago}
                          <span className='ml-2 text-xs text-muted-foreground font-normal'>
                            ({list.length} {list.length === 1 ? 'factura' : 'facturas'})
                            {pdfForma[key] === false && (
                              <span className='ml-2 text-amber-700'>· no saldrá en PDF</span>
                            )}
                          </span>
                        </TableCell>
                      </TableRow>
                      {list.map((f, i) => {
                        const anul = f.st_anulado === 'S'
                        return (
                          <TableRow key={`${key}-${f.tipo_factura}-${f.no_factura}-${i}`}
                                    className={anul ? 'text-red-600' : ''}>
                            <TableCell className='font-mono text-sm pl-6'>
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
                      <TableRow className='bg-muted/20 font-semibold'>
                        <TableCell colSpan={4} className='text-right pr-3'>Subtotal {it.forma_pago}</TableCell>
                        <TableCell className='text-right font-mono tabular-nums'>{fmtN(sub.desc)}</TableCell>
                        <TableCell className='text-right font-mono tabular-nums'>{fmtN(sub.itbis)}</TableCell>
                        <TableCell className='text-right font-mono tabular-nums'>{fmtN(sub.total)}</TableCell>
                      </TableRow>
                    </Fragment>
                  )
                })}
                <TableRow className='border-t-2 bg-muted/40 font-bold'>
                  <TableCell colSpan={6} className='text-right'>TOTAL ({facturas.length} facturas)</TableCell>
                  <TableCell className='text-right font-mono tabular-nums'>{fmtN(totalFacturas)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </section>
  )
}

// Sub-tabla mostrada al expandir una forma de pago.
function FacturasSubTabla({ rows }: { rows: FacturaItem[] }) {
  const sub = rows.reduce(
    (s, f) => ({
      total: s.total + (f.total_neto || 0),
      itbis: s.itbis + (f.impuesto || 0),
      desc: s.desc + (f.descuento || 0),
    }),
    { total: 0, itbis: 0, desc: 0 },
  )
  return (
    <Table>
      <TableHeader>
        <TableRow className='bg-muted/30'>
          <TableHead className='w-28'>No.</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead className='w-32'>NCF</TableHead>
          <TableHead className='w-24 text-right'>Descuento</TableHead>
          <TableHead className='w-24 text-right'>ITBIS</TableHead>
          <TableHead className='w-28 text-right'>Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((f, i) => {
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
              <TableCell className='text-right font-mono tabular-nums'>{fmtN(f.descuento || 0)}</TableCell>
              <TableCell className='text-right font-mono tabular-nums'>{fmtN(f.impuesto || 0)}</TableCell>
              <TableCell className='text-right font-mono tabular-nums font-semibold'>{fmtN(f.total_neto || 0)}</TableCell>
            </TableRow>
          )
        })}
        <TableRow className='bg-muted/20 font-semibold'>
          <TableCell colSpan={3} className='text-right'>Subtotal ({rows.length})</TableCell>
          <TableCell className='text-right font-mono tabular-nums'>{fmtN(sub.desc)}</TableCell>
          <TableCell className='text-right font-mono tabular-nums'>{fmtN(sub.itbis)}</TableCell>
          <TableCell className='text-right font-mono tabular-nums'>{fmtN(sub.total)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}
