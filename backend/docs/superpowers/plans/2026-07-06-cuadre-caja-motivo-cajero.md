# Cuadre de Caja — Motivo Anulación + Recibido/Devuelto + Vista de Cajero — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show cancellation reason + cash received/change in Cuadre de Caja and the factura POS detail, and add a new "Vista de Cajero" screen listing today's un-closed invoices.

**Architecture:** Django/Oracle backend (`apps/legacy/repositories/fat_repo.py`, `apps/fat/views.py`, `apps/fat/urls.py`) + React/TanStack frontend (`frontend/src/features/fat/*`, `frontend/src/features/pdf/*`). No schema changes — every Oracle column used already exists. Deploy model for this repo is **not** git-push-to-build: every edited file is uploaded to the running VM containers with `pscp` and hot-reloads (Django StatReloader / Vite HMR); verification is `curl` smoke tests against the live endpoints/routes, not `pytest`. Each task follows: edit → syntax/type sanity → pscp upload → curl/route smoke test → git commit.

**Tech Stack:** Django REST Framework, python-oracledb (via `apps/legacy/oracle_client.client`), React 18, TanStack Router/Query, shadcn/ui, Puck (PDF templates).

**Spec:** `backend/docs/superpowers/specs/2026-07-06-cuadre-caja-motivo-cajero-design.md`

**VM deploy facts** (see `sigaft-deploy-vm` skill for full detail):
- Host `jcabreu@10.0.0.99`, password `Temp1234!`, hostkey `SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc`.
- `plink`/`pscp` binary: `/c/Users/JCABREU/bin/plink.exe` / `pscp.exe` (same dir).
- Remote project root: `~/facturation-system` (relative paths below are relative to this).
- Login for smoke tests: username `JCABREU` (uppercase), password `Temp1234!`, endpoint `/api/auth/login/`.
- Never restart containers; never `git push` from the VM.

---

### Task 0: Reconcile the reverted Cuadre de Caja redesign from the VM into git

**Files:**
- Modify: `frontend/src/features/fat/cuadre-caja.tsx` (full replace)
- Modify: `frontend/src/features/pdf/blocks/index.tsx:1106-1633` (replace `BloqueCuadreCaja` region only)
- Modify: `frontend/src/features/pdf/defaults/cuadre-caja.ts:20`

This brings git back in sync with what's actually running on the VM (see spec §0) before any new feature work.

- [ ] **Step 1: Replace `frontend/src/features/fat/cuadre-caja.tsx` wholesale**

Use Write to replace the entire file with this content (this is the version currently live on the VM):

```tsx
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
  tipo_anula_dgii?: string; motivo_anulacion?: string
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
      rows.push(['Forma Pago', 'No. Factura', 'Cliente', 'NCF', 'Descuento', 'ITBIS', 'Total Neto', 'Anulada', 'Motivo Anulación'])
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
            f.st_anulado === 'S' ? (f.motivo_anulacion || '') : '',
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
                          <Fragment key={`${key}-${f.tipo_factura}-${f.no_factura}-${i}`}>
                            <TableRow className={anul ? 'text-red-600' : ''}>
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
                            {anul && f.motivo_anulacion && (
                              <TableRow className='text-red-600'>
                                <TableCell colSpan={7} className='pl-6 pt-0 pb-1.5 text-xs italic'>
                                  Motivo: {f.motivo_anulacion}
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
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
            <Fragment key={`${f.tipo_factura}-${f.no_factura}-${i}`}>
              <TableRow className={anul ? 'text-red-600' : ''}>
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
              {anul && f.motivo_anulacion && (
                <TableRow className='text-red-600'>
                  <TableCell colSpan={6} className='pt-0 pb-1.5 text-xs italic'>Motivo: {f.motivo_anulacion}</TableCell>
                </TableRow>
              )}
            </Fragment>
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
```

Note: this step already folds in the `motivo_anulacion` display (Task 3 depends on the backend field existing — until Task 3 lands, `f.motivo_anulacion` is simply `undefined` and the extra row doesn't render, which is safe).

- [ ] **Step 2: Replace the `BloqueCuadreCaja` region in `frontend/src/features/pdf/blocks/index.tsx`**

Read the file first. Find the region starting at the comment line
`// BloqueCuadreCaja — pinta resumen forma de pago + por NCF + matriz NCF×forma_pago`
and ending at the `}` that closes the `BloqueCuadreCaja` function, immediately
before the `// ────... Puck Config` separator comment. Replace that whole
region (types `ResumenPagoItem`, `PorNcfItem`, `NcfFormaPagoItem`,
`FacturaItem`, `labelNcfHuman`, `BloqueCuadreCajaProps`, `BloqueCuadreCaja`)
with:

```tsx
// ────────────────────────────────────────────────────────────────────
// BloqueCuadreCaja — pinta resumen forma de pago + por NCF + matriz NCF×forma_pago
// + opcionalmente detalle de facturas del día. Lee de payload.extra.
// ────────────────────────────────────────────────────────────────────
type ResumenPagoItem = { tipo_pago: string; forma_pago: string; cantidad: number; total: number }
type PorNcfItem = {
  ncf_tipo: string; cantidad: number
  total_linea: number; descuento: number; impuesto: number; total_neto: number
}
type NcfFormaPagoItem = {
  ncf_tipo: string; tipo_pago: string; forma_pago: string
  cantidad: number; total: number
}
type FacturaItem = {
  tipo_factura: string; no_factura: string; nombre_cliente?: string; ncf_dgi?: string
  fecha?: string | null; total_neto?: number; impuesto?: number; descuento?: number
  forma_pago?: string; estado?: string; st_anulado?: string; motivo_anulacion?: string
}

function labelNcfHuman(t: string): string {
  const k = (t || '').toUpperCase()
  const map: Record<string, string> = {
    B01: 'Crédito Fiscal', B02: 'Consumo', B03: 'Nota de Débito', B04: 'Nota de Crédito',
    B11: 'Proveedor Informal', B12: 'Registro Único', B13: 'Gastos Menores',
    B14: 'Régimen Especial', B15: 'Gubernamental', B16: 'Exportación',
  }
  return map[k] || ''
}

type BloqueCuadreCajaProps = {
  showResumenPago: boolean
  showPorNcf: boolean
  showMatrizNcfFormaPago: boolean
  showDetalleFacturas: boolean
  colorTitulo: string
  fontSize: number
}

function BloqueCuadreCaja({
  showResumenPago, showPorNcf, showMatrizNcfFormaPago, showDetalleFacturas,
  colorTitulo, fontSize,
}: BloqueCuadreCajaProps) {
  const data = usePdfData()
  if (!data || !isReportePayload(data)) return null
  const extra = ((data as ReportePrintPayload).extra ?? {}) as Record<string, unknown>
  const resumen = (extra.resumen_pago as ResumenPagoItem[]) ?? []
  const porNcf = (extra.por_ncf as PorNcfItem[]) ?? []
  const porNcfFormaPago = (extra.por_ncf_forma_pago as NcfFormaPagoItem[]) ?? []
  const facturasAll = (extra.facturas as FacturaItem[]) ?? []
  // El usuario activa "Incluir detalle" desde el switch de la pantalla —
  // viaja como extra.incluir_detalle. Sobreescribe la plantilla.
  const incluirDetalleFlag = !!extra.incluir_detalle
  const renderDetalle = showDetalleFacturas || incluirDetalleFlag
  // Switch "Ver detalle de NCF" del usuario — pinta la matriz NCF×forma_pago
  // solo si está prendido. Si la plantilla lo trae prendido también pinta.
  const showNcfDetailFlag = !!extra.show_ncf_detail
  const renderMatrizNcf = showMatrizNcfFormaPago || showNcfDetailFlag
  // Casilla manual "COBROS CRED. TRANSFERENCIA" (cobros a crédito recibidos
  // por transferencia). El cajero la captura en pantalla.
  const cobrosCredTransfer = Number(extra.cobros_cred_transfer || 0) || 0
  // Formas de pago cuyo detalle el cajero quiso incluir en el PDF (checkbox
  // por fila en la pantalla). Si no viene, se incluyen todas.
  const formasPagoPdfRaw = String(extra.formas_pago_pdf || '').trim()
  const formasPagoPdf = formasPagoPdfRaw
    ? new Set(formasPagoPdfRaw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))
    : null
  const facturas = formasPagoPdf
    ? facturasAll.filter((f) => formasPagoPdf.has((f.forma_pago || '').toUpperCase()))
    : facturasAll

  // Pivot NCF × forma_pago
  const formasSet = new Set<string>()
  const filaMap = new Map<string, { ncf_tipo: string; total: number; por: Record<string, number> }>()
  for (const r of porNcfFormaPago) {
    formasSet.add(r.forma_pago)
    let f = filaMap.get(r.ncf_tipo)
    if (!f) { f = { ncf_tipo: r.ncf_tipo, total: 0, por: {} }; filaMap.set(r.ncf_tipo, f) }
    f.por[r.forma_pago] = (f.por[r.forma_pago] || 0) + (r.total || 0)
    f.total += r.total || 0
  }
  const formas = [...formasSet].sort((a, b) => a.localeCompare(b, 'es'))
  const filasMx = [...filaMap.values()].sort((a, b) => a.ncf_tipo.localeCompare(b.ncf_tipo))
  const totalesCol: Record<string, number> = {}
  for (const f of formas) totalesCol[f] = filasMx.reduce((s, fila) => s + (fila.por[f] || 0), 0)
  const totalMatrix = filasMx.reduce((s, f) => s + f.total, 0)

  // Resumen ordenado: cobros crédito (tipo_pago C*) al final
  const resumenSorted = [...resumen].sort((a, b) => {
    const ac = (a.tipo_pago || '').startsWith('C')
    const bc = (b.tipo_pago || '').startsWith('C')
    if (ac !== bc) return ac ? 1 : -1
    return (a.forma_pago || '').localeCompare(b.forma_pago || '', 'es')
  })
  // Separación contado vs crédito (sugerencia Roberto/Angel 2026-06-17).
  const esCred = (tp: string) => (tp || '').toUpperCase().startsWith('C')
  const ventasContado = resumenSorted.filter(r => !esCred(r.tipo_pago))
  const ventasCredito = resumenSorted.filter(r => esCred(r.tipo_pago))
  const totalContado = ventasContado.reduce((s, r) => s + (r.total || 0), 0)
  const totalCredito = ventasCredito.reduce((s, r) => s + (r.total || 0), 0)
  const totalVentas = totalContado + totalCredito
  const totalCobrosDia = totalContado + cobrosCredTransfer
  const totalPorNcf = porNcf.reduce((s, r) => s + (r.total_neto || 0), 0)
  const totalFacturas = facturas.reduce((s, f) => s + (f.total_neto || 0), 0)

  const sectionTitle: any = {
    fontSize: fontSize + 2, fontWeight: 700, color: colorTitulo,
    margin: '12px 0 4px 0', borderBottom: `1px solid ${colorTitulo}33`, paddingBottom: 2,
  }
  const tableStyle: any = { width: '100%', borderCollapse: 'collapse', fontSize }
  const thBase: any = {
    background: colorTitulo, color: '#fff', padding: '4px 6px', textAlign: 'left',
    fontWeight: 700,
  }
  const td: any = { padding: '3px 6px', borderBottom: '1px solid #e5e7eb' }
  const tdR: any = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
  const tfootRow: any = { background: '#f3f4f6', fontWeight: 700 }

  return (
    <div className="pdf-cuadre-caja">
      {showResumenPago && (
        <>
          {/* Card 1 — Ventas del Día (contado vs crédito) */}
          <div style={sectionTitle}>Ventas del Día</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thBase}>Concepto</th>
                <th style={{ ...thBase, textAlign: 'right', width: '25%' }}>Monto RD$</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={td}>Ventas en efectivo / cobradas hoy</td>
                <td style={tdR}>{money(totalContado)}</td>
              </tr>
              <tr>
                <td style={td}>Ventas a crédito del día (pendiente CxC)</td>
                <td style={tdR}>{money(totalCredito)}</td>
              </tr>
              <tr style={tfootRow}>
                <td style={tdR}>Total Ventas del Día</td>
                <td style={tdR}>{money(totalVentas)}</td>
              </tr>
            </tbody>
          </table>

          {/* Card 2 — Cobros del Día por Forma de Pago */}
          <div style={sectionTitle}>Cobros del Día por Forma de Pago</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thBase, width: '15%' }}>Tipo</th>
                <th style={thBase}>Descripción</th>
                <th style={{ ...thBase, textAlign: 'right', width: '12%' }}>Cant.</th>
                <th style={{ ...thBase, textAlign: 'right', width: '20%' }}>Monto RD$</th>
              </tr>
            </thead>
            <tbody>
              {ventasContado.length === 0 && cobrosCredTransfer === 0 ? (
                <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: '#777' }}>Sin cobros.</td></tr>
              ) : (
                <>
                  {ventasContado.map((r, i) => (
                    <tr key={`${r.tipo_pago}-${r.forma_pago}-${i}`}>
                      <td style={{ ...td, fontFamily: 'monospace' }}>{r.tipo_pago}</td>
                      <td style={td}>{r.forma_pago}</td>
                      <td style={tdR}>{r.cantidad}</td>
                      <td style={tdR}>{money(r.total)}</td>
                    </tr>
                  ))}
                  {cobrosCredTransfer > 0 && (
                    <tr style={{ background: '#fef3c7' }}>
                      <td style={{ ...td, fontFamily: 'monospace' }}>—</td>
                      <td style={td}>COBROS CRED. TRANSFERENCIA</td>
                      <td style={tdR}>—</td>
                      <td style={tdR}>{money(cobrosCredTransfer)}</td>
                    </tr>
                  )}
                  <tr style={tfootRow}>
                    <td colSpan={3} style={tdR}>Total Cobros del Día</td>
                    <td style={tdR}>{money(totalCobrosDia)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>

          {/* Card 3 — Facturación a Crédito (informativo) */}
          {ventasCredito.length > 0 && (
            <>
              <div style={sectionTitle}>Facturación a Crédito (no entró plata — pendiente CxC)</div>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...thBase, width: '15%' }}>Tipo</th>
                    <th style={thBase}>Descripción</th>
                    <th style={{ ...thBase, textAlign: 'right', width: '12%' }}>Cant.</th>
                    <th style={{ ...thBase, textAlign: 'right', width: '20%' }}>Monto RD$</th>
                  </tr>
                </thead>
                <tbody>
                  {ventasCredito.map((r, i) => (
                    <tr key={`cr-${r.tipo_pago}-${r.forma_pago}-${i}`}>
                      <td style={{ ...td, fontFamily: 'monospace' }}>{r.tipo_pago}</td>
                      <td style={td}>{r.forma_pago}</td>
                      <td style={tdR}>{r.cantidad}</td>
                      <td style={tdR}>{money(r.total)}</td>
                    </tr>
                  ))}
                  <tr style={tfootRow}>
                    <td colSpan={3} style={tdR}>Total Crédito</td>
                    <td style={tdR}>{money(totalCredito)}</td>
                  </tr>
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      {showPorNcf && (
        <>
          <div style={sectionTitle}>Resumen por Tipo NCF (DGII)</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thBase, width: '8%' }}>Tipo</th>
                <th style={thBase}>Descripción</th>
                <th style={{ ...thBase, textAlign: 'right', width: '8%' }}>Cant.</th>
                <th style={{ ...thBase, textAlign: 'right' }}>Total Línea</th>
                <th style={{ ...thBase, textAlign: 'right' }}>Descuento</th>
                <th style={{ ...thBase, textAlign: 'right' }}>ITBIS</th>
                <th style={{ ...thBase, textAlign: 'right' }}>Total Neto</th>
              </tr>
            </thead>
            <tbody>
              {porNcf.length === 0 ? (
                <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#777' }}>Sin facturas.</td></tr>
              ) : porNcf.map((r) => (
                <tr key={r.ncf_tipo}>
                  <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700 }}>{r.ncf_tipo || '—'}</td>
                  <td style={td}>{labelNcfHuman(r.ncf_tipo)}</td>
                  <td style={tdR}>{r.cantidad}</td>
                  <td style={tdR}>{money(r.total_linea)}</td>
                  <td style={tdR}>{money(r.descuento)}</td>
                  <td style={tdR}>{money(r.impuesto)}</td>
                  <td style={{ ...tdR, fontWeight: 700 }}>{money(r.total_neto)}</td>
                </tr>
              ))}
              {porNcf.length > 0 && (
                <tr style={tfootRow}>
                  <td colSpan={6} style={tdR}>TOTAL</td>
                  <td style={tdR}>{money(totalPorNcf)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {renderMatrizNcf && formas.length > 0 && (
        <>
          <div style={sectionTitle}>Cuadre de Caja por NCF · NCF × Forma de Pago</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thBase, width: '8%' }}>NCF</th>
                <th style={thBase}>Descripción</th>
                {formas.map((f) => (
                  <th key={f} style={{ ...thBase, textAlign: 'right' }}>{f}</th>
                ))}
                <th style={{ ...thBase, textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {filasMx.map((fila) => (
                <tr key={fila.ncf_tipo}>
                  <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700 }}>{fila.ncf_tipo || '—'}</td>
                  <td style={td}>{labelNcfHuman(fila.ncf_tipo)}</td>
                  {formas.map((f) => (
                    <td key={f} style={tdR}>{fila.por[f] ? money(fila.por[f]) : ''}</td>
                  ))}
                  <td style={{ ...tdR, fontWeight: 700 }}>{money(fila.total)}</td>
                </tr>
              ))}
              <tr style={tfootRow}>
                <td colSpan={2} style={tdR}>TOTAL</td>
                {formas.map((f) => <td key={f} style={tdR}>{money(totalesCol[f] || 0)}</td>)}
                <td style={tdR}>{money(totalMatrix)}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {renderDetalle && (() => {
        // Agrupar facturas por FORMA DE PAGO (mismo agrupamiento que el
        // resumen principal del cuadre). Cada grupo muestra el subtotal.
        type Grupo = { forma_pago: string; rows: FacturaItem[]; total: number; itbis: number; descuento: number }
        const groups = new Map<string, Grupo>()
        for (const f of facturas) {
          const key = (f.forma_pago || 'SIN FORMA DE PAGO').toUpperCase().trim() || 'SIN FORMA DE PAGO'
          const g = groups.get(key) || { forma_pago: key, rows: [], total: 0, itbis: 0, descuento: 0 }
          g.rows.push(f)
          g.total += f.total_neto || 0
          g.itbis += f.impuesto || 0
          g.descuento += f.descuento || 0
          groups.set(key, g)
        }
        const facturasPorForma = [...groups.values()].sort((a, b) => a.forma_pago.localeCompare(b.forma_pago, 'es'))
        const grupoHdr: any = { ...td, background: '#e2e8f0', fontWeight: 700 }
        const subTotalRow: any = { ...td, background: '#f1f5f9', fontWeight: 700 }
        return (
          <>
            <div style={sectionTitle}>Detalle de Facturas · agrupado por Forma de Pago</div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thBase, width: '14%' }}>No.</th>
                  <th style={{ ...thBase, width: '10%' }}>Fecha</th>
                  <th style={thBase}>Cliente</th>
                  <th style={{ ...thBase, width: '14%' }}>NCF</th>
                  <th style={{ ...thBase, textAlign: 'right' }}>Descuento</th>
                  <th style={{ ...thBase, textAlign: 'right' }}>ITBIS</th>
                  <th style={{ ...thBase, textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {facturasPorForma.length === 0 ? (
                  <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#777' }}>Sin facturas en el día.</td></tr>
                ) : facturasPorForma.map((g) => (
                  <Fragment key={g.forma_pago}>
                    <tr>
                      <td colSpan={7} style={grupoHdr}>
                        <span>{g.forma_pago}</span>
                        <span style={{ marginLeft: 8, fontSize: fontSize - 1, color: '#555' }}>({g.rows.length} facturas)</span>
                      </td>
                    </tr>
                    {g.rows.map((f, i) => {
                      const num = `${f.tipo_factura || ''}-${f.no_factura || ''}`
                      const anul = (f.st_anulado === 'S')
                      return (
                        <Fragment key={`${g.forma_pago}-${num}-${i}`}>
                          <tr style={anul ? { color: '#b91c1c' } : undefined}>
                            <td style={{ ...td, fontFamily: 'monospace', paddingLeft: 14 }}>{num}{anul ? ' (ANUL)' : ''}</td>
                            <td style={td}>{fmtDate(f.fecha)}</td>
                            <td style={td}>{(f.nombre_cliente || '').slice(0, 60)}</td>
                            <td style={{ ...td, fontFamily: 'monospace' }}>{f.ncf_dgi || '—'}</td>
                            <td style={tdR}>{money(f.descuento ?? 0)}</td>
                            <td style={tdR}>{money(f.impuesto ?? 0)}</td>
                            <td style={tdR}>{money(f.total_neto ?? 0)}</td>
                          </tr>
                          {anul && f.motivo_anulacion && (
                            <tr style={{ color: '#b91c1c' }}>
                              <td colSpan={7} style={{ ...td, paddingLeft: 14, fontStyle: 'italic', fontSize: fontSize - 1 }}>
                                Motivo: {f.motivo_anulacion}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                    <tr>
                      <td colSpan={4} style={{ ...subTotalRow, textAlign: 'right' }}>Subtotal {g.forma_pago}</td>
                      <td style={{ ...subTotalRow, textAlign: 'right' }}>{money(g.descuento)}</td>
                      <td style={{ ...subTotalRow, textAlign: 'right' }}>{money(g.itbis)}</td>
                      <td style={{ ...subTotalRow, textAlign: 'right' }}>{money(g.total)}</td>
                    </tr>
                  </Fragment>
                ))}
                {facturasPorForma.length > 0 && (
                  <tr style={tfootRow}>
                    <td colSpan={6} style={tdR}>TOTAL FACTURAS ({facturas.length})</td>
                    <td style={tdR}>{money(totalFacturas)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )
      })()}
    </div>
  )
}
```

This differs from the VM's version in exactly two spots (both additive,
matching spec §1 and §2): the `formasPagoPdf` filter (was silently dropped
before) and the `motivo_anulacion` line under anulada rows.

- [ ] **Step 3: Flip the default in `frontend/src/features/pdf/defaults/cuadre-caja.ts:20`**

```ts
      showMatrizNcfFormaPago: false,
```

- [ ] **Step 4: Syntax-sanity locally (TypeScript is not fully type-checked in this repo's Vite dev flow — just confirm no stray brace/paren issues)**

Read back the 3 edited files and confirm balanced braces around the regions touched (the Edit/Write tool already validates the file was written; this is a manual re-read, not a build).

- [ ] **Step 5: Upload the 3 files to the VM**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system"
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/features/fat/cuadre-caja.tsx \
  jcabreu@10.0.0.99:facturation-system/frontend/src/features/fat/
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/features/pdf/blocks/index.tsx \
  jcabreu@10.0.0.99:facturation-system/frontend/src/features/pdf/blocks/
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/features/pdf/defaults/cuadre-caja.ts \
  jcabreu@10.0.0.99:facturation-system/frontend/src/features/pdf/defaults/
```

Since these are the same files already live on the VM (this step is a no-op
for `cuadre-caja.tsx` content-wise except it re-affirms it, and a real change
for the other two), this is safe.

- [ ] **Step 6: Smoke test the route still renders**

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "curl -s -o /dev/null -w 'cuadre-caja=%{http_code}\n' http://localhost:5173/fat/cuadre-caja"
```
Expect `cuadre-caja=200`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/fat/cuadre-caja.tsx frontend/src/features/pdf/blocks/index.tsx frontend/src/features/pdf/defaults/cuadre-caja.ts
git commit -m "$(cat <<'EOF'
chore(fat): reconciliar cuadre-caja con la version live en la VM

El rediseno con cards (Ventas Contado/Credito, Cobros por Forma de Pago
expandible, Facturacion a Credito) quedo revertido en git el 2026-06-17
pero nunca se redeployo el revert a la VM -- sigue siendo lo que el
usuario usa a diario. Se sincroniza git para que coincida, y de paso se
arregla el filtro formas_pago_pdf que nunca se aplicaba en el bloque PDF.
EOF
)"
```

---

### Task 1: Forward PDF print-options through the print route

**Files:**
- Modify: `frontend/src/routes/print/$codigo.$id.tsx`
- Deploy only (no edits — already correct in git, never uploaded to the VM): `frontend/src/features/pdf/PrintPage.tsx`, `frontend/src/features/pdf/use-print-doc.ts`

**Confirmed live on 2026-07-06 by the user:** even with "Incluir detalle de
facturas en el PDF" switched ON, the printed PDF shows no detail at all.
Root cause is worse than just the route dropping 3 params — it's two
levels deep:

1. `frontend/src/routes/print/$codigo.$id.tsx` only reads `tipo_doc` and
   `incluir_detalle` out of the query string (drops `show_ncf_detail`,
   `formas_pago_pdf`, `cobros_cred_transfer`).
2. Worse: the VM's currently-deployed `PrintPage.tsx` and `use-print-doc.ts`
   predate the `extra` prop entirely (confirmed by diff against git HEAD —
   git already fixed this in commit `ebd0963`, "enhance PDF printing
   functionality", but it was never `pscp`'d to the VM). The VM's route file
   builds an `extra` object and passes `extra={extra}` to `<PrintPage>`, but
   VM's `PrintPage` doesn't declare an `extra` prop — React silently drops
   it — and VM's `usePrintDoc(codigo, id, no_cia, punto)` has no `extra`
   parameter at all, so its query string to `print-data` only ever contains
   `no_cia`/`punto`. **`incluir_detalle` itself never reaches the backend on
   the VM today, regardless of the switch.** This is exactly the bug the
   user is seeing.

Git's versions of `PrintPage.tsx` and `use-print-doc.ts` already do this
correctly (generic `extra` passthrough, plus a `normalizeTemplate` safety
net that forces the `cuadre-caja` default template whenever a saved custom
template doesn't contain a `BloqueCuadreCaja` block). They need **zero code
changes** — just deploying to the VM, which nothing in this plan happened
to do until now. Combined with fixing the route (which does need editing —
git's route file is equally behind on the 3 newer params, since the
revert-and-rebuild history in Task 0 never touched this route), this closes
the gap generically for any future document.

- [ ] **Step 1: Replace the file**

```tsx
import { createFileRoute, useSearch } from '@tanstack/react-router'
import { PrintPage } from '@/features/pdf/PrintPage'

type Search = {
  no_cia?: string; punto?: string; tipo_doc?: string;
  incluir_detalle?: string; templateDraft?: string;
  show_ncf_detail?: string; formas_pago_pdf?: string; cobros_cred_transfer?: string;
}

export const Route = createFileRoute('/print/$codigo/$id')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    no_cia: typeof s.no_cia === 'string' ? s.no_cia : undefined,
    punto: typeof s.punto === 'string' ? s.punto : undefined,
    tipo_doc: typeof s.tipo_doc === 'string' ? s.tipo_doc : undefined,
    incluir_detalle: typeof s.incluir_detalle === 'string' ? s.incluir_detalle : undefined,
    templateDraft: typeof s.templateDraft === 'string' ? s.templateDraft : undefined,
    show_ncf_detail: typeof s.show_ncf_detail === 'string' ? s.show_ncf_detail : undefined,
    formas_pago_pdf: typeof s.formas_pago_pdf === 'string' ? s.formas_pago_pdf : undefined,
    cobros_cred_transfer: typeof s.cobros_cred_transfer === 'string' ? s.cobros_cred_transfer : undefined,
  }),
  component: _Page,
})

function _Page() {
  const { codigo, id } = Route.useParams()
  const search = useSearch({ from: '/print/$codigo/$id' }) as Search
  const extra: Record<string, string> = {}
  if (search.tipo_doc) extra.tipo_doc = search.tipo_doc
  if (search.incluir_detalle) extra.incluir_detalle = search.incluir_detalle
  if (search.show_ncf_detail) extra.show_ncf_detail = search.show_ncf_detail
  if (search.formas_pago_pdf) extra.formas_pago_pdf = search.formas_pago_pdf
  if (search.cobros_cred_transfer) extra.cobros_cred_transfer = search.cobros_cred_transfer
  return (
    <PrintPage
      codigo={codigo}
      id={id}
      no_cia={search.no_cia ?? '01'}
      punto={search.punto ?? '01'}
      extra={extra}
      noAutoPrint={search.templateDraft === '1'}
    />
  )
}
```

- [ ] **Step 2: Upload the route file AND the 2 already-fixed files that were never deployed**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system"
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  "frontend/src/routes/print/\$codigo.\$id.tsx" \
  jcabreu@10.0.0.99:facturation-system/frontend/src/routes/print/
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/features/pdf/PrintPage.tsx frontend/src/features/pdf/use-print-doc.ts \
  jcabreu@10.0.0.99:facturation-system/frontend/src/features/pdf/
```

This last upload is the critical one: it's what actually makes
`incluir_detalle` (and the 3 new params) reach the backend at all. Without
it, Task 1's route edit alone changes nothing observable.

- [ ] **Step 3: Smoke-test**

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "curl -s -o /dev/null -w 'print=%{http_code}\n' 'http://localhost:5173/print/cuadre-caja/2026-07-06?no_cia=01&punto=01&incluir_detalle=1&show_ncf_detail=1'"
```
Expect `print=200`. Then manually: in the browser, open Cuadre de Caja for
a date with facturas, switch "Incluir detalle de facturas en el PDF" ON,
click "Imprimir PDF", and confirm the "Detalle de Facturas · agrupado por
Forma de Pago" section now actually appears (this is the exact defect the
user reported live — verify it's actually fixed, don't just trust the
200).

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/routes/print/\$codigo.\$id.tsx"
git commit -m "fix(pdf): reenviar show_ncf_detail, formas_pago_pdf y cobros_cred_transfer a print-data

La pantalla de cuadre de caja ya mandaba estos 3 params por query string,
pero la ruta /print/:codigo/:id solo reenviaba tipo_doc e incluir_detalle
-- los otros 3 se perdian silenciosamente. Ademas, PrintPage.tsx y
use-print-doc.ts en la VM eran versiones viejas (pre-ebd0963) que ni
siquiera soportaban el prop extra -- por eso ni incluir_detalle llegaba
al backend con el switch prendido. Esos 2 archivos ya estaban arreglados
en git; solo faltaba desplegarlos."
```

Note: `PrintPage.tsx`/`use-print-doc.ts` have no local changes (git already
has the fix), so there's nothing new to `git add` for them — the commit
only needs the route file.

---

### Task 2: Backend — motivo de anulación (catálogo + join)

**Files:**
- Modify: `backend/apps/legacy/repositories/fat_repo.py` (functions `list_facturas`, `get_factura`; new function `list_motivos_anulacion_dgii`)
- Modify: `backend/apps/fat/views.py` (new class `FatMotivosAnulacionView`)
- Modify: `backend/apps/fat/urls.py`

- [ ] **Step 1: Add `list_motivos_anulacion_dgii` to `fat_repo.py`**

Add this function right after `anular_factura` (search for `def anular_factura`, insert the new function after that function's closing, before the next `# --` section comment):

```python
def list_motivos_anulacion_dgii() -> list[dict]:
    """Catalogo DGII de motivos de anulacion (FAT.TFAT_TANULACION_DGII).
    No depende de no_cia -- es un catalogo fijo, igual que su uso en
    rep_ncf_nulos."""
    rows = client.fetch_dicts(
        "SELECT tipo, descripcion FROM FAT.TFAT_TANULACION_DGII ORDER BY tipo",
        [])
    return [{'tipo': (r['tipo'] or '').strip(),
             'descripcion': (r['descripcion'] or '').strip()} for r in rows]
```

- [ ] **Step 2: Add the join to `list_facturas`**

In `list_facturas` (`fat_repo.py`), find this inner SELECT (the one inside
the `ROWNUM`-paginated subquery):

```python
        SELECT * FROM (
            SELECT a.*, ROWNUM rn FROM (
                SELECT f.no_cia, f.punto, f.tipo_factura, f.no_factura, f.no_cliente,
                    c.nombre AS nombre_cliente, f.fecha, f.vendedor,
                    f.total_linea, f.descuento, f.impuesto, f.total_neto,
                    f.estado, f.ncf, f.posiciones_fijas_ncf, f.codigo_ncf, f.tipo_ncf_fiscal,
                    f.plazo_pago, f.forma_pago_fat, f.st_anulado, f.st_impresion
                FROM FAT.TFAT_FACTURA f
                LEFT JOIN CXC.TCXC_CLIENTE c
                  ON c.no_cia = f.no_cia AND c.punto = f.punto AND c.no_cliente = f.no_cliente
                WHERE {where}
                ORDER BY f.fecha DESC, f.no_factura DESC
            ) a WHERE ROWNUM <= :end_row
        ) WHERE rn > :start_row
```

Replace with (adds `f.tipo_anula_dgii`, joins `TFAT_TANULACION_DGII`, adds `ta.descripcion`):

```python
        SELECT * FROM (
            SELECT a.*, ROWNUM rn FROM (
                SELECT f.no_cia, f.punto, f.tipo_factura, f.no_factura, f.no_cliente,
                    c.nombre AS nombre_cliente, f.fecha, f.vendedor,
                    f.total_linea, f.descuento, f.impuesto, f.total_neto,
                    f.estado, f.ncf, f.posiciones_fijas_ncf, f.codigo_ncf, f.tipo_ncf_fiscal,
                    f.plazo_pago, f.forma_pago_fat, f.st_anulado, f.st_impresion,
                    f.tipo_anula_dgii, ta.descripcion AS motivo_anulacion
                FROM FAT.TFAT_FACTURA f
                LEFT JOIN CXC.TCXC_CLIENTE c
                  ON c.no_cia = f.no_cia AND c.punto = f.punto AND c.no_cliente = f.no_cliente
                LEFT JOIN FAT.TFAT_TANULACION_DGII ta
                  ON ta.tipo = f.tipo_anula_dgii
                WHERE {where}
                ORDER BY f.fecha DESC, f.no_factura DESC
            ) a WHERE ROWNUM <= :end_row
        ) WHERE rn > :start_row
```

Then in the same function's return dict, find:

```python
            'st_anulado': r['st_anulado'] or 'N', 'st_impresion': r['st_impresion'] or 'N',
        } for r in rows],
```

Replace with:

```python
            'st_anulado': r['st_anulado'] or 'N', 'st_impresion': r['st_impresion'] or 'N',
            'tipo_anula_dgii': r['tipo_anula_dgii'] or '',
            'motivo_anulacion': (r['motivo_anulacion'] or '').strip(),
        } for r in rows],
```

- [ ] **Step 3: Add the same fields to `get_factura`**

Find (the single-factura SELECT):

```python
    rows = client.fetch_dicts(
        "SELECT f.no_cia, f.punto, f.tipo_factura, f.no_factura, f.no_cliente, "
        "c.nombre AS nombre_cliente, f.fecha, f.vendedor, "
        "f.total_linea, f.descuento, f.impuesto, f.total_neto, f.propina, "
        "f.estado, f.ncf, f.posiciones_fijas_ncf, f.codigo_ncf, f.tipo_ncf_fiscal, "
        "f.plazo_pago, f.forma_pago_fat, f.no_condicion_pago, "
        "f.tasa_us, f.porc_impuesto, f.nota, f.detalle, "
        "f.st_anulado, f.st_impresion, f.st_generado_cnt "
        "FROM FAT.TFAT_FACTURA f "
        "LEFT JOIN CXC.TCXC_CLIENTE c "
        "  ON c.no_cia = f.no_cia AND c.punto = f.punto AND c.no_cliente = f.no_cliente "
        "WHERE f.no_cia=:1 AND f.punto=:2 AND f.tipo_factura=:3 AND f.no_factura=:4",
        [no_cia, punto, tipo_factura.strip().upper(), no_factura.strip()])
```

Replace with:

```python
    rows = client.fetch_dicts(
        "SELECT f.no_cia, f.punto, f.tipo_factura, f.no_factura, f.no_cliente, "
        "c.nombre AS nombre_cliente, f.fecha, f.vendedor, "
        "f.total_linea, f.descuento, f.impuesto, f.total_neto, f.propina, "
        "f.estado, f.ncf, f.posiciones_fijas_ncf, f.codigo_ncf, f.tipo_ncf_fiscal, "
        "f.plazo_pago, f.forma_pago_fat, f.no_condicion_pago, "
        "f.tasa_us, f.porc_impuesto, f.nota, f.detalle, "
        "f.st_anulado, f.st_impresion, f.st_generado_cnt, "
        "f.tipo_anula_dgii, ta.descripcion AS motivo_anulacion, "
        "NVL(f.valor_recibido,0) AS valor_recibido, NVL(f.valor_devuelto,0) AS valor_devuelto "
        "FROM FAT.TFAT_FACTURA f "
        "LEFT JOIN CXC.TCXC_CLIENTE c "
        "  ON c.no_cia = f.no_cia AND c.punto = f.punto AND c.no_cliente = f.no_cliente "
        "LEFT JOIN FAT.TFAT_TANULACION_DGII ta "
        "  ON ta.tipo = f.tipo_anula_dgii "
        "WHERE f.no_cia=:1 AND f.punto=:2 AND f.tipo_factura=:3 AND f.no_factura=:4",
        [no_cia, punto, tipo_factura.strip().upper(), no_factura.strip()])
```

Then find the returned dict's tail:

```python
        'st_anulado': r['st_anulado'] or 'N', 'st_impresion': r['st_impresion'] or 'N',
        'st_generado_cnt': r['st_generado_cnt'] or 'N',
```

Replace with:

```python
        'st_anulado': r['st_anulado'] or 'N', 'st_impresion': r['st_impresion'] or 'N',
        'st_generado_cnt': r['st_generado_cnt'] or 'N',
        'tipo_anula_dgii': r['tipo_anula_dgii'] or '',
        'motivo_anulacion': (r['motivo_anulacion'] or '').strip(),
        'valor_recibido': float(r['valor_recibido'] or 0),
        'valor_devuelto': float(r['valor_devuelto'] or 0),
```

(Read the file around this area first — the exact tail keys are followed by
a closing `}` a couple of lines below; only the two lines shown need to
change, the rest of the dict/function is untouched.)

- [ ] **Step 4: Syntax check on the VM**

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "python3 -c \"import ast; ast.parse(open('/home/jcabreu/facturation-system/backend/apps/legacy/repositories/fat_repo.py').read())\""
```
(Upload the file first — see Step 6 — then run this. Expect no output = valid syntax.)

- [ ] **Step 5: Add `FatMotivosAnulacionView` to `backend/apps/fat/views.py`**

Insert right after the `FatAnularFacturaView` class body ends (before `class FatVendedoresView`):

```python
class FatMotivosAnulacionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            return Response({'items': fat_repo.list_motivos_anulacion_dgii()})
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


```

- [ ] **Step 6: Wire the URL**

In `backend/apps/fat/urls.py`, add `FatMotivosAnulacionView` to the import
from `.views` (in the list that already includes `FatAnularFacturaView`):

```python
    FatFacturasView, FatFacturaDetailView, FatAnularFacturaView,
    FatMotivosAnulacionView,
```

And add the route right after `fat/facturas/anular/`:

```python
    path('fat/facturas/anular/', FatAnularFacturaView.as_view()),
    path('fat/anulacion-motivos/', FatMotivosAnulacionView.as_view()),
```

- [ ] **Step 7: Upload all 3 backend files**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system"
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  backend/apps/legacy/repositories/fat_repo.py \
  jcabreu@10.0.0.99:facturation-system/backend/apps/legacy/repositories/
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  backend/apps/fat/views.py backend/apps/fat/urls.py \
  jcabreu@10.0.0.99:facturation-system/backend/apps/fat/
```

- [ ] **Step 8: Smoke test**

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "rm -f /tmp/cookie.txt && \
   curl -s -c /tmp/cookie.txt -X POST -H 'Content-Type: application/json' \
        -d '{\"username\":\"JCABREU\",\"password\":\"Temp1234!\"}' \
        http://localhost:8000/api/auth/login/ -w '\nLOGIN=%{http_code}\n' && \
   curl -s -b /tmp/cookie.txt 'http://localhost:8000/api/fat/anulacion-motivos/' -w '\nHTTP=%{http_code}\n' && \
   curl -s -b /tmp/cookie.txt 'http://localhost:8000/api/fat/facturas/?no_cia=01&punto=01&page=1&page_size=5' -w '\nHTTP=%{http_code}\n' | head -c 500"
```
Expect `LOGIN=200`, first `HTTP=200` with a JSON `items` array of `{tipo, descripcion}`,
second `HTTP=200` with `motivo_anulacion` and `tipo_anula_dgii` keys present on each item.

- [ ] **Step 9: Commit**

```bash
git add backend/apps/legacy/repositories/fat_repo.py backend/apps/fat/views.py backend/apps/fat/urls.py
git commit -m "feat(fat): catalogo de motivos de anulacion DGII + exponer motivo_anulacion

list_facturas y get_factura ahora hacen LEFT JOIN a FAT.TFAT_TANULACION_DGII
y devuelven motivo_anulacion junto al tipo_anula_dgii que ya se persistia.
Nuevo endpoint GET /api/fat/anulacion-motivos/ para poblar el select del
modal de anular factura (tarea siguiente)."
```

---

### Task 3: Frontend — Select de motivo al anular + mostrar el motivo

**Files:**
- Modify: `frontend/src/lib/regal-general-api.ts` (add `fatMotivosAnulacion`)
- Modify: `frontend/src/features/fat/fat-facturas.tsx`

- [ ] **Step 1: Add the API call**

In `regal-general-api.ts`, right after `fatAnularFactura` (search for that
key), add:

```ts
  fatMotivosAnulacion: () =>
    request<{ items: Array<{ tipo: string; descripcion: string }> }>('/fat/anulacion-motivos/'),

```

- [ ] **Step 2: Replace the anular modal's free-text motivo with a Select**

In `fat-facturas.tsx`:

1. Add `motivo_anulacion` and `tipo_anula_dgii` to the `Factura` and
   `FacturaDetalle` types (find the `type Factura = {...}` block, add after
   `st_anulado: string; st_impresion: string`):

```ts
type Factura = {
  no_cia: string; punto: string; tipo_factura: string; no_factura: string
  no_cliente: number; nombre_cliente: string; fecha: string | null
  vendedor: string; total_linea: number; descuento: number
  impuesto: number; total_neto: number; estado: string
  ncf: number | null; posiciones_fijas_ncf?: string; ncf_dgi?: string
  codigo_ncf: string; tipo_ncf_fiscal: string
  plazo_pago: number; forma_pago: string; st_anulado: string; st_impresion: string
  tipo_anula_dgii?: string; motivo_anulacion?: string
}

type FacturaDetalle = Factura & {
  propina: number; tasa_us: number; porc_impuesto: number
  nota: string; detalle: string; no_condicion_pago: string
  st_generado_cnt: string
  valor_recibido?: number; valor_devuelto?: number
  lineas: Array<{
    no_linea: number; no_produ: string; descripcion: string
    cantidad: number; precio: number; porc_descuento: number
    descuento: number; porciento_impuesto: number; impuesto: number
    monto_neto: number; cantidad_regalia: number; st_anulado: string
  }>
}
```

2. Replace `Textarea` import with `Select` components already imported
   (they already are — `Select, SelectContent, SelectItem, SelectTrigger,
   SelectValue` is imported at the top for the filters). Remove the now-unused
   `Textarea` import line (`import { Textarea } from '@/components/ui/textarea'`).

3. Replace the anulación state block:

```ts
  // Anulación state
  const [anularTarget, setAnularTarget] = useState<Factura | null>(null)
  const [anularMotivo, setAnularMotivo] = useState('')
  const [anularLiberarNcf, setAnularLiberarNcf] = useState(false)
  const [anularLoading, setAnularLoading] = useState(false)
  const [anularError, setAnularError] = useState('')
```

with:

```ts
  // Anulación state
  const [anularTarget, setAnularTarget] = useState<Factura | null>(null)
  const [anularTipoDgii, setAnularTipoDgii] = useState('')
  const [anularLiberarNcf, setAnularLiberarNcf] = useState(false)
  const [anularLoading, setAnularLoading] = useState(false)
  const [anularError, setAnularError] = useState('')
  const [motivosAnulacion, setMotivosAnulacion] = useState<Array<{ tipo: string; descripcion: string }>>([])

  useEffect(() => {
    regalGeneralApi.fatMotivosAnulacion()
      .then((d) => setMotivosAnulacion(d.items || []))
      .catch(() => {})
  }, [])
```

4. Replace `openAnular` and `confirmAnular`:

```ts
  const openAnular = (e: React.MouseEvent, row: Factura) => {
    e.stopPropagation()
    setAnularTarget(row)
    setAnularTipoDgii('')
    setAnularLiberarNcf(false)
    setAnularError('')
  }

  const confirmAnular = async () => {
    if (!anularTarget) return
    if (!anularTipoDgii) {
      setAnularError('Seleccione el motivo de anulación.')
      return
    }
    setAnularLoading(true)
    setAnularError('')
    try {
      await regalGeneralApi.fatAnularFactura({
        no_cia: noCia,
        punto,
        tipo_factura: anularTarget.tipo_factura,
        no_factura: anularTarget.no_factura,
        tipo_anula_dgii: anularTipoDgii,
        liberar_ncf: anularLiberarNcf,
      })
      setAnularTarget(null)
      load(page)
    } catch (err: any) {
      setAnularError(err?.message ?? 'Error al anular la factura.')
    } finally {
      setAnularLoading(false)
    }
  }
```

5. Replace the modal body (the `<div className='space-y-1'>` block with the
   `Textarea` for "Motivo (opcional)"):

```tsx
              <div className='space-y-1'>
                <Label htmlFor='anular-motivo'>Motivo de anulación</Label>
                <Select value={anularTipoDgii} onValueChange={setAnularTipoDgii}>
                  <SelectTrigger id='anular-motivo' disabled={anularLoading}>
                    <SelectValue placeholder='Seleccione un motivo…' />
                  </SelectTrigger>
                  <SelectContent>
                    {motivosAnulacion.map((m) => (
                      <SelectItem key={m.tipo} value={m.tipo}>{m.tipo} — {m.descripcion}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
```

6. Add `useEffect` to the React import line at the top if not already
   present (`fat-facturas.tsx` already imports `useEffect` — confirm, no
   change needed there).

- [ ] **Step 3: Show the motivo in the list and the detail modal**

In the facturas table body, the anulada badge row already exists (search
for `isAnulada ? { label: 'Anulada' ...`). Add a small caption under the
client name cell when anulada and a motivo exists — find:

```tsx
                <TableCell className='max-w-[200px] truncate'>{row.nombre_cliente || `Cliente #${row.no_cliente}`}</TableCell>
```

Replace with:

```tsx
                <TableCell className='max-w-[200px]'>
                  <div className='truncate'>{row.nombre_cliente || `Cliente #${row.no_cliente}`}</div>
                  {isAnulada && row.motivo_anulacion && (
                    <div className='truncate text-xs italic text-destructive'>Motivo: {row.motivo_anulacion}</div>
                  )}
                </TableCell>
```

In the detail modal, find the `Estado` row:

```tsx
                <div><span className='text-muted-foreground'>Estado:</span> <Badge variant={selected.st_anulado === 'S' ? 'destructive' : (ESTADO_BADGE[selected.estado]?.variant ?? 'outline')}>{selected.st_anulado === 'S' ? 'Anulada' : (ESTADO_BADGE[selected.estado]?.label ?? selected.estado)}</Badge></div>
```

Add right after it (still inside the same grid):

```tsx
                {selected.st_anulado === 'S' && selected.motivo_anulacion && (
                  <div className='col-span-2'><span className='text-muted-foreground'>Motivo anulación:</span> <span className='text-destructive'>{selected.motivo_anulacion}</span></div>
                )}
```

- [ ] **Step 4: Add the motivo column to the CSV export**

Find `exportCsv`'s header row and mapping:

```ts
      ['Tipo', 'No.Factura', 'Fecha', 'Cliente', 'Vendedor', 'Total Línea', 'Desc.', 'ITBIS', 'Total Neto', 'Estado', 'NCF', 'Anulada'],
      rows.map((r) => [r.tipo_factura, r.no_factura, r.fecha ?? '', r.nombre_cliente, r.vendedor,
        r.total_linea, r.descuento, r.impuesto, r.total_neto, r.estado, r.ncf ?? '', r.st_anulado]),
```

Replace with:

```ts
      ['Tipo', 'No.Factura', 'Fecha', 'Cliente', 'Vendedor', 'Total Línea', 'Desc.', 'ITBIS', 'Total Neto', 'Estado', 'NCF', 'Anulada', 'Motivo Anulación'],
      rows.map((r) => [r.tipo_factura, r.no_factura, r.fecha ?? '', r.nombre_cliente, r.vendedor,
        r.total_linea, r.descuento, r.impuesto, r.total_neto, r.estado, r.ncf ?? '', r.st_anulado,
        r.st_anulado === 'S' ? (r.motivo_anulacion ?? '') : '']),
```

- [ ] **Step 5: Upload and smoke test**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system"
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/lib/regal-general-api.ts frontend/src/features/fat/fat-facturas.tsx \
  jcabreu@10.0.0.99:facturation-system/frontend/src/lib/
```
(pscp with two source files and one destination copies both into that dir —
but they live in different local subfolders, so upload each separately):

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system"
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/lib/regal-general-api.ts \
  jcabreu@10.0.0.99:facturation-system/frontend/src/lib/
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/features/fat/fat-facturas.tsx \
  jcabreu@10.0.0.99:facturation-system/frontend/src/features/fat/
```

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "curl -s -o /dev/null -w 'facturas=%{http_code}\n' http://localhost:5173/fat/facturas"
```
Expect `facturas=200`. Then manually open the browser to `/fat/facturas`,
click the anular icon on a non-anulada row, confirm the Select populates
with real DGII motivos, pick one, confirm, and verify the row now shows
"Anulada" + the motivo underneath the client name.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/regal-general-api.ts frontend/src/features/fat/fat-facturas.tsx
git commit -m "feat(fat): anular factura pide motivo DGII real (select) y lo muestra

El Textarea libre 'Motivo (opcional)' nunca se guardaba -- el backend lo
descartaba. Se reemplaza por un Select poblado desde
FAT.TFAT_TANULACION_DGII que manda tipo_anula_dgii (ya soportado por el
backend) y se muestra el motivo resultante en la lista, el detalle y el
CSV de Facturas."
```

---

### Task 4: Backend — Recibido / Devuelto en `create_factura`

**Files:**
- Modify: `backend/apps/legacy/repositories/fat_repo.py` (`create_factura`)
- Modify: `backend/apps/fat/views.py` (`FatFacturasView.post`)

- [ ] **Step 1: Extend `create_factura`'s signature**

Find:

```python
def create_factura(no_cia, punto, tipo_factura, no_cliente, fecha, vendedor,
                   forma_pago, no_lista, nota, lineas, usuario,
                   codigo_ncf: str = "", detalle: str = ""):
```

Replace with:

```python
def create_factura(no_cia, punto, tipo_factura, no_cliente, fecha, vendedor,
                   forma_pago, no_lista, nota, lineas, usuario,
                   codigo_ncf: str = "", detalle: str = "",
                   valor_recibido: float = 0.0):
```

- [ ] **Step 2: Compute `valor_devuelto` right before the INSERT**

Find:

```python
        total_neto = total_linea - total_descuento + total_impuesto
        cur.execute(
            "INSERT INTO FAT.TFAT_FACTURA("
```

Replace with:

```python
        total_neto = total_linea - total_descuento + total_impuesto
        valor_devuelto = round(max(0.0, valor_recibido - total_neto), 2) if valor_recibido else 0.0
        cur.execute(
            "INSERT INTO FAT.TFAT_FACTURA("
```

- [ ] **Step 3: Add the 2 columns to the INSERT**

Find:

```python
            "no_cia,punto,tipo_factura,no_factura,no_cliente,fecha,vendedor,"
            "total_linea,descuento,impuesto,total_neto,estado,"
            "ncf,codigo_ncf,tipo_ncf_fiscal,posiciones_fijas_ncf,"
            "st_anulado,st_impresion,st_generado_cnt,"
            "usuario,nota,no_formulario,tipo_transaccion,"
            "tasa_us,porc_impuesto,no_condicion_pago,tipo_moneda,"
            "propina,plazo_pago,afecta_cxc,forma_pago_fat,fecha_sysdate,detalle"
            ") VALUES("
            ":1,:2,:3,:4,:5,TO_DATE(:6,'YYYY-MM-DD'),:7,"
            ":8,:9,:10,:11,'A',"
            ":12,:13,:14,:15,"
            "'N','N','N',"
            ":16,:17,:18,:19,"
            "57.5,18,'','RD',"
            "0,0,:20,:21,SYSDATE,:22"
            ")",
            [no_cia, punto, tf, new_no_factura, no_cliente, fecha, vendedor,
             total_linea, total_descuento, total_impuesto, total_neto,
             ncf_val, codigo_ncf_emitir, tipo_ncf_fiscal, posiciones_fijas_ncf,
             usuario, nota, str(prox_formulario), tipo_transaccion,
             afecta_cxc, fp, detalle_s])
```

Replace with:

```python
            "no_cia,punto,tipo_factura,no_factura,no_cliente,fecha,vendedor,"
            "total_linea,descuento,impuesto,total_neto,estado,"
            "ncf,codigo_ncf,tipo_ncf_fiscal,posiciones_fijas_ncf,"
            "st_anulado,st_impresion,st_generado_cnt,"
            "usuario,nota,no_formulario,tipo_transaccion,"
            "tasa_us,porc_impuesto,no_condicion_pago,tipo_moneda,"
            "propina,plazo_pago,afecta_cxc,forma_pago_fat,fecha_sysdate,detalle,"
            "valor_recibido,valor_devuelto"
            ") VALUES("
            ":1,:2,:3,:4,:5,TO_DATE(:6,'YYYY-MM-DD'),:7,"
            ":8,:9,:10,:11,'A',"
            ":12,:13,:14,:15,"
            "'N','N','N',"
            ":16,:17,:18,:19,"
            "57.5,18,'','RD',"
            "0,0,:20,:21,SYSDATE,:22,"
            ":23,:24"
            ")",
            [no_cia, punto, tf, new_no_factura, no_cliente, fecha, vendedor,
             total_linea, total_descuento, total_impuesto, total_neto,
             ncf_val, codigo_ncf_emitir, tipo_ncf_fiscal, posiciones_fijas_ncf,
             usuario, nota, str(prox_formulario), tipo_transaccion,
             afecta_cxc, fp, detalle_s, valor_recibido, valor_devuelto])
```

- [ ] **Step 4: Return `valor_devuelto` in the function's result dict** (so the frontend can show "Devuelta: X" right after saving without a second fetch)

Find:

```python
    return {"no_factura": new_no_factura, "tipo_factura": tf, "ncf": ncf_val,
            "total_neto": total_neto, "total_linea": total_linea,
            "descuento": total_descuento, "impuesto": total_impuesto}
```

Replace with:

```python
    return {"no_factura": new_no_factura, "tipo_factura": tf, "ncf": ncf_val,
            "total_neto": total_neto, "total_linea": total_linea,
            "descuento": total_descuento, "impuesto": total_impuesto,
            "valor_recibido": valor_recibido, "valor_devuelto": valor_devuelto}
```

- [ ] **Step 5: Read `valor_recibido` in the view**

In `backend/apps/fat/views.py`, `FatFacturasView.post`, find:

```python
        try:
            res = fat_repo.create_factura(
                no_cia=str(no_cia).strip(), punto=str(punto).strip(),
                tipo_factura=str(tipo_factura).strip(),
                no_cliente=int(no_cliente), fecha=str(fecha).strip(),
                vendedor=str(vendedor).strip(), forma_pago=str(forma_pago).strip(),
                no_lista=str(no_lista).strip(), nota=str(nota).strip(),
                detalle=str(detalle).strip(), lineas=lineas,
                usuario=request.user.username,
                codigo_ncf=str(request.data.get('codigo_ncf', '')).strip())
```

Replace with:

```python
        try:
            valor_recibido_raw = request.data.get('valor_recibido')
            valor_recibido = float(valor_recibido_raw) if valor_recibido_raw not in (None, '') else 0.0
            res = fat_repo.create_factura(
                no_cia=str(no_cia).strip(), punto=str(punto).strip(),
                tipo_factura=str(tipo_factura).strip(),
                no_cliente=int(no_cliente), fecha=str(fecha).strip(),
                vendedor=str(vendedor).strip(), forma_pago=str(forma_pago).strip(),
                no_lista=str(no_lista).strip(), nota=str(nota).strip(),
                detalle=str(detalle).strip(), lineas=lineas,
                usuario=request.user.username,
                codigo_ncf=str(request.data.get('codigo_ncf', '')).strip(),
                valor_recibido=valor_recibido)
```

- [ ] **Step 6: Upload and smoke test**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system"
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  backend/apps/legacy/repositories/fat_repo.py \
  jcabreu@10.0.0.99:facturation-system/backend/apps/legacy/repositories/
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  backend/apps/fat/views.py \
  jcabreu@10.0.0.99:facturation-system/backend/apps/fat/
```

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "python3 -c \"import ast; ast.parse(open('/home/jcabreu/facturation-system/backend/apps/legacy/repositories/fat_repo.py').read())\" && echo SYNTAX_OK"
```
Expect `SYNTAX_OK`. Full end-to-end verification (actually creating an
invoice) happens in Task 5 once the frontend can send `valor_recibido`.

- [ ] **Step 7: Commit**

```bash
git add backend/apps/legacy/repositories/fat_repo.py backend/apps/fat/views.py
git commit -m "feat(fat): persistir valor_recibido/valor_devuelto al crear factura en efectivo

Las columnas ya existian en Oracle sin uso. create_factura ahora acepta
valor_recibido opcional, calcula valor_devuelto = max(0, recibido - total)
y los guarda. El endpoint POST /api/fat/facturas/ lee valor_recibido del
body si viene."
```

---

### Task 5: Frontend — capturar Recibido/Devuelto en Nueva Factura

**Files:**
- Modify: `frontend/src/features/fat/fat-nueva-factura.tsx`

- [ ] **Step 1: Add the `esEfectivoLabel` helper**

Find:

```ts
const esContadoLabel = (desc: string) => /contado|cash|efectivo/i.test(desc)
```

Add right after it:

```ts
const esEfectivoLabel = (desc: string) => /efectivo|cash/i.test(desc)
```

- [ ] **Step 2: Add `valorRecibido` state and the `esEfectivo`/`devuelto` derived values**

Find:

```ts
  // Is contado?
  const pagoSeleccionado = tiposPago.find((p) => p.tipo_pago === formaPago)
  const esContado = pagoSeleccionado
    ? esContadoLabel(pagoSeleccionado.descripcion)
    : false
```

Replace with:

```ts
  // Is contado?
  const pagoSeleccionado = tiposPago.find((p) => p.tipo_pago === formaPago)
  const esContado = pagoSeleccionado
    ? esContadoLabel(pagoSeleccionado.descripcion)
    : false
  const esEfectivo = pagoSeleccionado
    ? esEfectivoLabel(pagoSeleccionado.descripcion)
    : false
```

Find the `guardando` state declaration:

```ts
  const [guardando, setGuardando] = useState(false)
```

Add right after it:

```ts
  const [valorRecibido, setValorRecibido] = useState('')
```

Right after the `totalNeto` calculation (find `const totalNeto = baseNeta + itbisTotal`), add:

```ts
  const valorRecibidoNum = Number((valorRecibido || '0').replace(',', '.')) || 0
  const valorDevuelto = esEfectivo ? Math.max(0, valorRecibidoNum - totalNeto) : 0
```

- [ ] **Step 3: Reset `valorRecibido` whenever forma de pago stops being efectivo**

Find `handleFormaPagoChange`:

```ts
  const handleFormaPagoChange = (value: string) => {
    setFormaPago(value)
    const tp = tiposPago.find((p) => p.tipo_pago === value)
    if (tp && esContadoLabel(tp.descripcion)) {
```

Add right after `setFormaPago(value)`:

```ts
  const handleFormaPagoChange = (value: string) => {
    setFormaPago(value)
    const tpEf = tiposPago.find((p) => p.tipo_pago === value)
    if (!tpEf || !esEfectivoLabel(tpEf.descripcion)) setValorRecibido('')
    const tp = tiposPago.find((p) => p.tipo_pago === value)
    if (tp && esContadoLabel(tp.descripcion)) {
```

- [ ] **Step 4: Validate before saving**

Find, in `guardar()`:

```ts
    const lineasValidas = lineas.filter((l) => l.no_produ && l.cantidad > 0)
    if (lineasValidas.length === 0) {
      toast({
        title: 'Validacion',
        description: 'Agregue al menos una linea',
        variant: 'destructive',
      })
      return
    }
```

Add right after that block:

```ts
    if (esEfectivo && valorRecibidoNum < totalNeto) {
      toast({
        title: 'Validacion',
        description: `Recibido (${fmtN(valorRecibidoNum)}) es menor al total (${fmtN(totalNeto)})`,
        variant: 'destructive',
      })
      return
    }
```

- [ ] **Step 5: Send `valor_recibido` in the payload**

Find, inside `regalGeneralApi.fatCrearFactura({...})`:

```ts
        tipo_ingreso: tipoIngreso,
        itbis_en_precio: itbisEnPrecio,
        no_cotizacion: noCotizacion,
```

Replace with:

```ts
        tipo_ingreso: tipoIngreso,
        itbis_en_precio: itbisEnPrecio,
        no_cotizacion: noCotizacion,
        valor_recibido: esEfectivo ? valorRecibidoNum : undefined,
```

- [ ] **Step 6: Add the Recibido/Devuelta inputs next to the totals**

Find:

```tsx
              <div className='mt-1 flex justify-between border-t pt-2 text-xl font-bold'>
                <span>Total Neto:</span>
                <span className='font-mono'>{fmtN(totalNeto)}</span>
              </div>
            </div>
          </div>
        )}
```

Replace with:

```tsx
              <div className='mt-1 flex justify-between border-t pt-2 text-xl font-bold'>
                <span>Total Neto:</span>
                <span className='font-mono'>{fmtN(totalNeto)}</span>
              </div>
              {esEfectivo && (
                <>
                  <div className='flex items-center justify-between gap-2 pt-2'>
                    <span>Recibido:</span>
                    <Input
                      type='number' step='0.01' min='0' placeholder='0.00'
                      value={valorRecibido}
                      onChange={(e) => setValorRecibido(e.target.value)}
                      className='h-8 w-32 text-right font-mono'
                    />
                  </div>
                  <div className={`flex justify-between font-semibold ${valorRecibidoNum > 0 && valorRecibidoNum < totalNeto ? 'text-destructive' : ''}`}>
                    <span>Devuelta:</span>
                    <span className='font-mono'>{fmtN(valorDevuelto)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
```

(`Input` is already imported in this file for other fields — no new import
needed.)

- [ ] **Step 7: Upload and smoke test**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system"
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/features/fat/fat-nueva-factura.tsx \
  jcabreu@10.0.0.99:facturation-system/frontend/src/features/fat/
```

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "curl -s -o /dev/null -w 'nueva-factura=%{http_code}\n' http://localhost:5173/fat/nueva-factura"
```
Expect `nueva-factura=200`. Then manually: open `/fat/nueva-factura`, pick a
client, add a line, select a forma de pago whose descripción contains
"Efectivo" and confirm the Recibido/Devuelta fields appear; type a recibido
less than the total and confirm Guardar is blocked with the validation
toast; type a valid recibido and save; confirm the created invoice appears
correctly and (once Task 6 lands) shows Recibido/Devuelto in its detail.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/fat/fat-nueva-factura.tsx
git commit -m "feat(fat): capturar recibido/devuelto al facturar en efectivo

Cuando la forma de pago matchea 'efectivo' (no solo 'contado', que
tambien cubre tarjeta/transferencia) se muestran 2 campos junto al
total: Recibido (input) y Devuelta (calculado). Bloquea el guardado si
recibido no alcanza el total."
```

---

### Task 6: Componente compartido de detalle de factura + mostrar Recibido/Devuelto

**Files:**
- Create: `frontend/src/features/fat/factura-detalle-dialog.tsx`
- Modify: `frontend/src/features/fat/fat-facturas.tsx`

This extracts the detail `<Dialog>` (info grid + líneas table + totales +
nota) out of `fat-facturas.tsx` into a standalone component so Task 8's
Vista de Cajero can reuse it verbatim instead of duplicating ~90 lines of
JSX.

- [ ] **Step 1: Create the shared component**

```tsx
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Printer } from 'lucide-react'
import { fmtN } from './fat-export'

export type FacturaDetalleData = {
  tipo_factura: string; no_factura: string
  nombre_cliente: string; no_cliente: number
  fecha: string | null; vendedor: string; forma_pago: string
  plazo_pago: number; ncf_dgi?: string; codigo_ncf: string; ncf: number | null
  estado: string; st_anulado: string; st_generado_cnt: string
  motivo_anulacion?: string
  valor_recibido?: number; valor_devuelto?: number
  total_linea: number; descuento: number; impuesto: number
  propina?: number; total_neto: number
  nota?: string
  lineas: Array<{
    no_linea: number; no_produ: string; descripcion: string
    cantidad: number; precio: number; porc_descuento: number
    porciento_impuesto: number; monto_neto: number; st_anulado: string
  }>
}

const ESTADO_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  A: { label: 'Autorizada', variant: 'default' },
  P: { label: 'Pendiente',  variant: 'secondary' },
  C: { label: 'Cancelada',  variant: 'destructive' },
}

interface Props {
  factura: FacturaDetalleData | null
  loading: boolean
  onClose: () => void
  onPrint?: () => void
}

export function FacturaDetalleDialog({ factura, loading, onClose, onPrint }: Props) {
  return (
    <Dialog open={!!factura || loading} onOpenChange={onClose}>
      <DialogContent className='max-w-[70vw] max-h-[70vh] overflow-y-auto'>
        <DialogHeader>
          <div className='flex items-center justify-between'>
            <DialogTitle>
              {factura ? `Factura ${factura.tipo_factura} ${factura.no_factura}` : 'Cargando…'}
            </DialogTitle>
            {factura && onPrint && (
              <Button variant='outline' size='sm' onClick={onPrint} className='mr-8'>
                <Printer className='mr-2 h-4 w-4' /> Imprimir
              </Button>
            )}
          </div>
        </DialogHeader>

        {loading && <p className='py-8 text-center text-muted-foreground'>Cargando detalle…</p>}
        {factura && !loading && (
          <div className='space-y-4 text-sm'>
            <div className='grid grid-cols-2 gap-x-8 gap-y-1 rounded-lg border p-3'>
              <div><span className='text-muted-foreground'>Cliente:</span> <strong>{factura.nombre_cliente || `#${factura.no_cliente}`}</strong></div>
              <div><span className='text-muted-foreground'>Fecha:</span> {factura.fecha}</div>
              <div><span className='text-muted-foreground'>Vendedor:</span> {factura.vendedor || '—'}</div>
              <div><span className='text-muted-foreground'>Forma pago:</span> {factura.forma_pago || '—'}</div>
              <div><span className='text-muted-foreground'>Plazo:</span> {factura.plazo_pago ? `${factura.plazo_pago} días` : '—'}</div>
              <div><span className='text-muted-foreground'>NCF:</span> <span className='font-mono'>{factura.ncf_dgi || `${factura.codigo_ncf} ${factura.ncf ?? ''}`}</span></div>
              <div><span className='text-muted-foreground'>Estado:</span> <Badge variant={factura.st_anulado === 'S' ? 'destructive' : (ESTADO_BADGE[factura.estado]?.variant ?? 'outline')}>{factura.st_anulado === 'S' ? 'Anulada' : (ESTADO_BADGE[factura.estado]?.label ?? factura.estado)}</Badge></div>
              <div><span className='text-muted-foreground'>Generado CNT:</span> {factura.st_generado_cnt === 'S' ? 'Sí' : 'No'}</div>
              {factura.st_anulado === 'S' && factura.motivo_anulacion && (
                <div className='col-span-2'><span className='text-muted-foreground'>Motivo anulación:</span> <span className='text-destructive'>{factura.motivo_anulacion}</span></div>
              )}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-10'>#</TableHead>
                  <TableHead className='w-24'>Producto</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className='w-16 text-right'>Cant.</TableHead>
                  <TableHead className='w-20 text-right'>Precio</TableHead>
                  <TableHead className='w-16 text-right'>%Desc</TableHead>
                  <TableHead className='w-20 text-right'>%ITBIS</TableHead>
                  <TableHead className='w-24 text-right'>Neto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {factura.lineas.filter((l) => l.st_anulado !== 'S').map((l) => (
                  <TableRow key={l.no_linea}>
                    <TableCell>{l.no_linea}</TableCell>
                    <TableCell className='font-mono'>{l.no_produ}</TableCell>
                    <TableCell>{l.descripcion}</TableCell>
                    <TableCell className='text-right'>{l.cantidad.toLocaleString('en-US')}</TableCell>
                    <TableCell className='text-right font-mono'>{fmtN(l.precio)}</TableCell>
                    <TableCell className='text-right'>{l.porc_descuento ? `${l.porc_descuento}%` : ''}</TableCell>
                    <TableCell className='text-right'>{l.porciento_impuesto ? `${l.porciento_impuesto}%` : ''}</TableCell>
                    <TableCell className='text-right font-mono'>{fmtN(l.monto_neto)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className='flex justify-end'>
              <table className='text-sm'>
                <tbody>
                  <tr><td className='pr-8 text-muted-foreground'>Total Línea</td><td className='text-right font-mono'>{fmtN(factura.total_linea)}</td></tr>
                  <tr><td className='pr-8 text-muted-foreground'>Descuento</td><td className='text-right font-mono'>{fmtN(factura.descuento)}</td></tr>
                  <tr><td className='pr-8 text-muted-foreground'>ITBIS</td><td className='text-right font-mono'>{fmtN(factura.impuesto)}</td></tr>
                  {(factura.propina ?? 0) > 0 && (
                    <tr><td className='pr-8 text-muted-foreground'>Propina</td><td className='text-right font-mono'>{fmtN(factura.propina!)}</td></tr>
                  )}
                  <tr className='border-t font-semibold'><td className='pt-1 pr-8'>Total Neto</td><td className='pt-1 text-right font-mono'>{fmtN(factura.total_neto)}</td></tr>
                  {(factura.valor_recibido ?? 0) > 0 && (
                    <>
                      <tr><td className='pr-8 text-muted-foreground'>Recibido</td><td className='text-right font-mono'>{fmtN(factura.valor_recibido!)}</td></tr>
                      <tr><td className='pr-8 text-muted-foreground'>Devuelto</td><td className='text-right font-mono'>{fmtN(factura.valor_devuelto ?? 0)}</td></tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {factura.nota && (
              <p className='rounded border bg-muted/30 p-2 text-xs text-muted-foreground'><strong>Nota:</strong> {factura.nota}</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Use it from `fat-facturas.tsx`**

Remove the inline `<Dialog>` block for the detail modal (the one starting
`{/* Detalle modal */}` through its matching closing `</Dialog>`, right
before `{/* Anulación modal */}`), and the now-unused `Eye`/`Dialog` JSX for
that specific modal. Replace with:

```tsx
      <FacturaDetalleDialog
        factura={selected}
        loading={loadingDetail}
        onClose={() => setSelected(null)}
        onPrint={printDetail}
      />
```

Add the import at the top:

```ts
import { FacturaDetalleDialog } from './factura-detalle-dialog'
```

Keep `printDetail` as-is (still references `selected.*` the same way, since
`FacturaDetalle` still has all those fields — plus the 2 new ones from Task
2/4, `motivo_anulacion` and `valor_recibido`/`valor_devuelto`, which already
match `FacturaDetalleData`'s shape).

Note: `Dialog, DialogContent, DialogHeader, DialogTitle` are still used by
the *anulación* modal further down in this file — do not remove those
imports, only remove the now-redundant JSX block for the detail modal.

- [ ] **Step 3: Upload and smoke test**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system"
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/features/fat/factura-detalle-dialog.tsx frontend/src/features/fat/fat-facturas.tsx \
  jcabreu@10.0.0.99:facturation-system/frontend/src/features/fat/
```

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "curl -s -o /dev/null -w 'facturas=%{http_code}\n' http://localhost:5173/fat/facturas"
```
Expect `facturas=200`. Manually open `/fat/facturas`, click a row, confirm
the detail modal still renders identically (info grid, líneas, totales),
and if the invoice was created in efectivo, confirm Recibido/Devuelto show.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/fat/factura-detalle-dialog.tsx frontend/src/features/fat/fat-facturas.tsx
git commit -m "refactor(fat): extraer FacturaDetalleDialog compartido

Se separa el modal de detalle de fat-facturas.tsx a un componente propio
para reusarlo en la Vista de Cajero (siguiente tarea) sin duplicar JSX.
De paso muestra Recibido/Devuelto cuando la factura fue pagada en
efectivo."
```

---

### Task 7: Backend — facturas pendientes de cuadre (Vista de Cajero)

**Files:**
- Modify: `backend/apps/legacy/repositories/fat_repo.py` (new function `list_facturas_cajero`)
- Modify: `backend/apps/fat/views.py` (new class `FatCajeroPendientesView`)
- Modify: `backend/apps/fat/urls.py`

- [ ] **Step 1: Add `list_facturas_cajero` to `fat_repo.py`**

Insert right after `list_motivos_anulacion_dgii` (added in Task 2):

```python
def list_facturas_cajero(no_cia: str, punto: str, fecha: str) -> list[dict]:
    """Facturas del dia que aun no pertenecen a un cuadre de caja cerrado
    -- mismo criterio de 'dia en progreso' que usa el cuadre de caja
    (ausencia de fila en FAT.TFAT_CUADRE_CAJA para esa fecha)."""
    rows = client.fetch_dicts(
        "SELECT f.tipo_factura, f.no_factura, f.fecha, "
        "c.nombre AS nombre_cliente, f.total_neto, f.forma_pago_fat, "
        "NVL(f.valor_recibido,0) AS valor_recibido, "
        "NVL(f.valor_devuelto,0) AS valor_devuelto, "
        "f.st_anulado, f.posiciones_fijas_ncf, f.ncf "
        "FROM FAT.TFAT_FACTURA f "
        "LEFT JOIN CXC.TCXC_CLIENTE c "
        "  ON c.no_cia=f.no_cia AND c.punto=f.punto AND c.no_cliente=f.no_cliente "
        "WHERE f.no_cia=:1 AND f.punto=:2 AND TRUNC(f.fecha)=TO_DATE(:3,'YYYY-MM-DD') "
        "AND NOT EXISTS ("
        "  SELECT 1 FROM FAT.TFAT_CUADRE_CAJA cc "
        "  WHERE cc.no_cia=f.no_cia AND cc.punto=f.punto AND TRUNC(cc.fecha)=TRUNC(f.fecha)"
        ") "
        "ORDER BY f.fecha, f.no_factura",
        [no_cia, punto, fecha])
    return [{
        'tipo_factura': r['tipo_factura'] or '', 'no_factura': r['no_factura'] or '',
        'fecha': str(r['fecha'])[:10] if r['fecha'] else None,
        'nombre_cliente': (r['nombre_cliente'] or '').strip(),
        'total_neto': float(r['total_neto'] or 0),
        'forma_pago': r['forma_pago_fat'] or '',
        'valor_recibido': float(r['valor_recibido'] or 0),
        'valor_devuelto': float(r['valor_devuelto'] or 0),
        'st_anulado': r['st_anulado'] or 'N',
        'ncf_dgi': _compose_ncf_dgi(r['posiciones_fijas_ncf'], r['ncf']),
    } for r in rows]
```

- [ ] **Step 2: Add the view**

In `backend/apps/fat/views.py`, add `from datetime import date` to the
imports at the top (next to `import calendar`):

```python
import calendar
from datetime import date
```

Add the view class right after `FatMotivosAnulacionView` (added in Task 2):

```python
class FatCajeroPendientesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        forbidden = _check_fat_access(request.user.username, no_cia, punto)
        if forbidden:
            return forbidden
        fecha = request.query_params.get('fecha') or date.today().isoformat()
        try:
            items = fat_repo.list_facturas_cajero(no_cia, punto, fecha)
            return Response({'fecha': fecha, 'items': items})
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


```

- [ ] **Step 3: Wire the URL**

In `backend/apps/fat/urls.py`, add `FatCajeroPendientesView` to the `.views`
import list (next to `FatMotivosAnulacionView` from Task 2):

```python
    FatFacturasView, FatFacturaDetailView, FatAnularFacturaView,
    FatMotivosAnulacionView, FatCajeroPendientesView,
```

Add the route:

```python
    path('fat/anulacion-motivos/', FatMotivosAnulacionView.as_view()),
    path('fat/cajero/pendientes/', FatCajeroPendientesView.as_view()),
```

- [ ] **Step 4: Upload and smoke test**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system"
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  backend/apps/legacy/repositories/fat_repo.py \
  jcabreu@10.0.0.99:facturation-system/backend/apps/legacy/repositories/
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  backend/apps/fat/views.py backend/apps/fat/urls.py \
  jcabreu@10.0.0.99:facturation-system/backend/apps/fat/
```

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "rm -f /tmp/cookie.txt && \
   curl -s -c /tmp/cookie.txt -X POST -H 'Content-Type: application/json' \
        -d '{\"username\":\"JCABREU\",\"password\":\"Temp1234!\"}' \
        http://localhost:8000/api/auth/login/ -w '\nLOGIN=%{http_code}\n' && \
   curl -s -b /tmp/cookie.txt 'http://localhost:8000/api/fat/cajero/pendientes/?no_cia=01&punto=01' -w '\nHTTP=%{http_code}\n'"
```
Expect `LOGIN=200` and `HTTP=200` with `{"fecha": "...", "items": [...]}`.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/legacy/repositories/fat_repo.py backend/apps/fat/views.py backend/apps/fat/urls.py
git commit -m "feat(fat): endpoint de facturas pendientes de cuadre (vista de cajero)

GET /api/fat/cajero/pendientes/?no_cia=&punto=&fecha= devuelve las
facturas del dia que aun no pertenecen a un cuadre de caja cerrado --
mismo criterio de 'dia en progreso' que ya usa la pantalla de cuadre de
caja."
```

---

### Task 8: Frontend — Vista de Cajero

**Files:**
- Create: `frontend/src/features/fat/fat-cajero.tsx`
- Create: `frontend/src/routes/_authenticated/fat/cajero.tsx`
- Modify: `frontend/src/lib/regal-general-api.ts` (add `fatCajeroPendientes`)
- Modify: `frontend/src/components/layout/data/sidebar-data.ts`

- [ ] **Step 1: Add the API call**

In `regal-general-api.ts`, right after `fatMotivosAnulacion` (added in Task 3):

```ts
  fatCajeroPendientes: (no_cia: string, punto: string, fecha?: string) => {
    const p = new URLSearchParams({ no_cia, punto })
    if (fecha) p.set('fecha', fecha)
    return request<{
      fecha: string
      items: Array<{
        tipo_factura: string; no_factura: string; fecha: string | null
        nombre_cliente: string; total_neto: number; forma_pago: string
        valor_recibido: number; valor_devuelto: number
        st_anulado: string; ncf_dgi: string
      }>
    }>(`/fat/cajero/pendientes/?${p.toString()}`)
  },

```

- [ ] **Step 2: Create the screen**

```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Wallet } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fmtN } from './fat-export'
import { FacturaDetalleDialog, type FacturaDetalleData } from './factura-detalle-dialog'

interface Props { noCia: string; punto: string }

const TODAY = new Date().toISOString().slice(0, 10)

export function CajeroFat({ noCia, punto }: Props) {
  const [fecha, setFecha] = useState(TODAY)
  const [selected, setSelected] = useState<FacturaDetalleData | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const q = useQuery({
    queryKey: ['fat-cajero-pendientes', noCia, punto, fecha],
    queryFn: () => regalGeneralApi.fatCajeroPendientes(noCia, punto, fecha),
    enabled: !!noCia && !!fecha,
    staleTime: 30_000,
  })

  const items = q.data?.items ?? []

  const openDetail = async (tipo: string, noFactura: string) => {
    setLoadingDetail(true)
    try {
      const d = await regalGeneralApi.fatGetFactura(noCia, punto, tipo, noFactura)
      setSelected(d as FacturaDetalleData)
    } catch { /* ignore */ }
    finally { setLoadingDetail(false) }
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='flex items-center gap-2 text-lg font-semibold'>
            <Wallet className='h-5 w-5' /> Vista de Cajero
          </h2>
          <p className='text-sm text-muted-foreground'>
            Empresa {noCia} · Punto {punto} — facturas del día aún sin cuadre cerrado
          </p>
        </div>
        <Button variant='outline' size='sm' onClick={() => q.refetch()}>
          <RefreshCw className='mr-1 h-4 w-4' /> Actualizar
        </Button>
      </div>

      <div className='flex items-end gap-4 rounded-md border bg-muted/30 p-3'>
        <div className='space-y-1'>
          <Label htmlFor='cajero-fecha' className='text-xs text-muted-foreground'>Fecha</Label>
          <Input id='cajero-fecha' type='date' value={fecha}
                 onChange={(e) => setFecha(e.target.value)} className='h-9 w-44' />
        </div>
        {q.isFetching && <span className='pb-2 text-xs text-muted-foreground'>Cargando…</span>}
        {q.error && <span className='pb-2 text-xs text-red-600'>Error al cargar.</span>}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-28'>No.</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className='w-32'>NCF</TableHead>
            <TableHead className='w-24'>Forma Pago</TableHead>
            <TableHead className='w-28 text-right'>Total</TableHead>
            <TableHead className='w-28 text-right'>Recibido</TableHead>
            <TableHead className='w-28 text-right'>Devuelto</TableHead>
            <TableHead className='w-24 text-center'>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.isLoading && (
            <TableRow><TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>Cargando facturas del día…</TableCell></TableRow>
          )}
          {!q.isLoading && items.length === 0 && (
            <TableRow><TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>No hay facturas pendientes de cuadre para el {fecha}.</TableCell></TableRow>
          )}
          {items.map((f) => {
            const anulada = f.st_anulado === 'S'
            return (
              <TableRow
                key={`${f.tipo_factura}-${f.no_factura}`}
                className={`cursor-pointer hover:bg-muted/50 ${anulada ? 'opacity-60' : ''}`}
                onClick={() => openDetail(f.tipo_factura, f.no_factura)}
              >
                <TableCell className='font-mono'>{f.tipo_factura}-{f.no_factura}</TableCell>
                <TableCell className='max-w-[220px] truncate'>{f.nombre_cliente}</TableCell>
                <TableCell className='font-mono text-xs'>{f.ncf_dgi || '—'}</TableCell>
                <TableCell className='text-sm'>{f.forma_pago}</TableCell>
                <TableCell className='text-right font-mono tabular-nums'>{fmtN(f.total_neto)}</TableCell>
                <TableCell className='text-right font-mono tabular-nums'>{f.valor_recibido > 0 ? fmtN(f.valor_recibido) : '—'}</TableCell>
                <TableCell className='text-right font-mono tabular-nums'>{f.valor_recibido > 0 ? fmtN(f.valor_devuelto) : '—'}</TableCell>
                <TableCell className='text-center'>
                  {anulada
                    ? <Badge variant='destructive'>Anulada</Badge>
                    : <Badge variant='default'>OK</Badge>}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <FacturaDetalleDialog
        factura={selected}
        loading={loadingDetail}
        onClose={() => setSelected(null)}
      />
    </section>
  )
}
```

- [ ] **Step 3: Export `FacturaDetalleData` from `factura-detalle-dialog.tsx`**

Confirm the `export type FacturaDetalleData = {...}` from Task 6 Step 1 is
indeed exported (it is, per that step) so the `import { FacturaDetalleDialog,
type FacturaDetalleData }` above resolves.

- [ ] **Step 4: Create the route file**

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CajeroFat } from '@/features/fat/fat-cajero'

export const Route = createFileRoute('/_authenticated/fat/cajero')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <CajeroFat noCia={noCia} punto={punto} />
}
```

- [ ] **Step 5: Add the sidebar entry**

In `frontend/src/components/layout/data/sidebar-data.ts`, find:

```ts
                { title: 'Cuadre de Caja', url: '/fat/cuadre-caja' },
```

Replace with:

```ts
                { title: 'Cuadre de Caja', url: '/fat/cuadre-caja' },
                { title: 'Vista de Cajero', url: '/fat/cajero' },
```

- [ ] **Step 6: Upload all files**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system"
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/lib/regal-general-api.ts \
  jcabreu@10.0.0.99:facturation-system/frontend/src/lib/
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/features/fat/fat-cajero.tsx \
  jcabreu@10.0.0.99:facturation-system/frontend/src/features/fat/
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/components/layout/data/sidebar-data.ts \
  jcabreu@10.0.0.99:facturation-system/frontend/src/components/layout/data/

plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "mkdir -p ~/facturation-system/frontend/src/routes/_authenticated/fat"
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/routes/_authenticated/fat/cajero.tsx \
  jcabreu@10.0.0.99:facturation-system/frontend/src/routes/_authenticated/fat/
```

- [ ] **Step 7: Smoke test the new route (Vite must auto-regenerate `routeTree.gen.ts`)**

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "sleep 5 && curl -s -o /dev/null -w 'cajero=%{http_code}\n' http://localhost:5173/fat/cajero"
```
Expect `cajero=200`. If it's a 404, check
`docker logs --tail 30 facturation_frontend` for a TanStack Router codegen
error and re-check the route file's `createFileRoute('/_authenticated/fat/cajero')`
path matches its location exactly.

- [ ] **Step 8: Pull the regenerated `routeTree.gen.ts` back into git**

The VM's Vite dev server auto-regenerates this tracked file when it detects
the new route; download it so the local repo matches:

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "cat ~/facturation-system/frontend/src/routeTree.gen.ts" > "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/frontend/src/routeTree.gen.ts"
```

Confirm it now contains a `/fat/cajero` entry:

```bash
grep -c "fat/cajero" "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/frontend/src/routeTree.gen.ts"
```
Expect a number `>= 1`.

- [ ] **Step 9: Manual browser check**

Open `/fat/cajero` in the browser. Confirm: today's facturas (created
during Task 5/6 testing) appear with Recibido/Devuelto populated for the
efectivo one; clicking a row opens the same detail dialog used in
Consulta de Facturas; an anulada row shows the "Anulada" badge and, if it
has a motivo, the dialog shows it.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/lib/regal-general-api.ts frontend/src/features/fat/fat-cajero.tsx \
        frontend/src/routes/_authenticated/fat/cajero.tsx \
        frontend/src/components/layout/data/sidebar-data.ts frontend/src/routeTree.gen.ts
git commit -m "feat(fat): Vista de Cajero — facturas del dia pendientes de cuadre

Nueva ruta /fat/cajero: lista las facturas de hoy que aun no pertenecen a
un cuadre de caja cerrado, con Recibido/Devuelto por fila. Reusa
FacturaDetalleDialog al hacer click en una fila."
```

---

### Task 9: Verificación end-to-end en la VM

**Files:** none (verification only)

- [ ] **Step 1: Flujo completo en el navegador contra `http://10.0.0.99:5173`**

1. `/fat/nueva-factura` — crear una factura con forma de pago "Efectivo",
   Recibido mayor al total. Confirmar que se crea y el toast/print muestra
   el número correcto.
2. `/fat/cajero` — confirmar que la factura recién creada aparece con
   Recibido/Devuelto correctos y sin cuadre cerrado para hoy.
3. `/fat/facturas` — abrir esa factura, confirmar Recibido/Devuelto en el
   detalle; anularla eligiendo un motivo real del Select; confirmar la fila
   pasa a "Anulada" con el motivo visible debajo del cliente.
4. `/fat/cuadre-caja` — con fecha de hoy: prender "Incluir detalle de
   facturas en el PDF", expandir la forma de pago de la factura anulada,
   confirmar que se ve en rojo con "(ANUL)" y la línea "Motivo: …" debajo.
5. Click "Excel" — abrir el CSV descargado, confirmar la columna "Motivo
   Anulación" tiene el texto correcto en la sección de detalle.
6. Click "Imprimir PDF" con "Incluir detalle" y "Ver detalle de NCF" ambos
   prendidos — confirmar que el PDF (nueva pestaña) muestra la matriz NCF ×
   forma de pago Y el motivo de anulación bajo la fila roja.

- [ ] **Step 2: Reportar resultado**

Si algún paso falla, volver a la tarea correspondiente (no ajustar el
código a mano fuera del plan) y repetir upload + smoke test de ese archivo
específico antes de continuar.
