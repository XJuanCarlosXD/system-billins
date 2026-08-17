import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { History, Pencil } from 'lucide-react'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DocumentoDetalleSheet } from '@/features/documentos/documento-detalle-sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { downloadCsv } from '@/lib/csv-utils'
import { cn } from '@/lib/utils'
import { HIGHLIGHT_ROW_CLASS } from '@/lib/sidebar-badges'
import { useDocHighlightCount } from '@/hooks/use-sidebar-badges'
import { esDocumentoEditable, usePeriodoActualCxP } from './corregir-documento-dialog'
import { DocumentoHistorial } from '@/features/historial/documento-historial'

interface Documento {
  no_cia: string; punto: string; tipo_docu: string; no_docu: string
  no_proveedor: string; nombre_proveedor: string
  fecha: string; fecha_vence: string
  valor_original: number; saldo: number; status: string
  ncf: number | null; tipo_transaccion: string; tipo_movi: string
  impuesto: number; itbis_retenido: number; isr_retenido: number
  pago_bloqueado: string
}

interface DocDetalle extends Documento {
  lineas: { cuenta: string; monto: number; tipo_movi: string }[]
  rnc: string; posiciones_fijas_ncf: string; ncf_dgi?: string; forma_pago: number
  debito: number; credito: number
  tipo_gasto?: string | null; tipo_retencion?: number | null
  tipo_docu_r?: string | null; no_docu_r?: string | null
  usuario?: string | null
  detalle?: string | null
}

const TIPO_DOC: Record<string, string> = {
  FP: 'Factura Proveedor',
  FT: 'Factura',
  NC: 'Nota de Crédito',
  ND: 'Nota de Débito',
  SO: 'Solicitud de Cheque',
  AC: 'Ajuste Crédito',
  AD: 'Ajuste Débito',
  BD: 'Balance Débito',
  BC: 'Balance Crédito',
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  A: { label: 'Abierto',    cls: 'bg-green-100 text-green-800' },
  C: { label: 'Cerrado',    cls: 'bg-gray-100 text-gray-600' },
  P: { label: 'Parcial',    cls: 'bg-blue-100 text-blue-800' },
  V: { label: 'Vencido',    cls: 'bg-red-100 text-red-700' },
  B: { label: 'Bloqueado',  cls: 'bg-orange-100 text-orange-700' },
  R: { label: 'Reversado',  cls: 'bg-purple-100 text-purple-700' },
}

const fmt = (n: number) => n?.toLocaleString('es-DO', { minimumFractionDigits: 2 }) ?? '0.00'
const fmtDate = (s: string) => s ? s.split('-').reverse().join('/') : ''
const PAGE = 50

// NCF DGI real: prefijo + LPAD(NCF). Tradicional (B01..B15) usa 8 dígitos
// (total 11). e-CF (E31/E32) usa 10 dígitos (total 13).
function composeNcfDgi(prefix: string | null | undefined, ncf: number | null | undefined): string {
  const p = (prefix || '').trim().toUpperCase()
  const n = typeof ncf === 'number' ? ncf : Number(ncf)
  if (!p || !n || n <= 0) return p || (n ? String(n) : '')
  const width = p.startsWith('E') ? 10 : 8
  return `${p}${String(n).padStart(width, '0')}`
}

function diasVencidos(fechaVence: string): number | null {
  if (!fechaVence) return null
  const vence = new Date(fechaVence)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const diff = Math.floor((hoy.getTime() - vence.getTime()) / 86400000)
  return diff > 0 ? diff : null
}

export function CxpDocumentos() {
  const navigate = useNavigate()
  const { selectedCompany: noCia, selectedPoint: punto } = useCompany()
  const [noProveedor, setNoProveedor] = useState('')
  const [tipo, setTipo] = useState('')
  const [noDoc, setNoDoc] = useState('')
  const [ncf, setNcf] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [status, setStatus] = useState('A')
  const [page, setPage] = useState(1)
  const newHl = useDocHighlightCount('cxp')
  const [selected, setSelected] = useState<string | null>(null)
  const [verHistorial, setVerHistorial] = useState(false)

  const enabled = !!noCia
  const periodoQ = usePeriodoActualCxP(noCia, punto)

  const { data = [], isLoading, isError } = useQuery<Documento[]>({
    queryKey: ['cxp-documentos', noCia, punto, noProveedor, tipo, noDoc, ncf, desde, hasta, status],
    queryFn: () => api.cxpListDocumentos({ no_cia: noCia, punto, no_proveedor: noProveedor, tipo, no_doc: noDoc, ncf, desde, hasta, status }),
    staleTime: 60_000,
    enabled,
  })

  const selectedKey = selected ? selected.split('|') : null
  const { data: detalle } = useQuery<DocDetalle>({
    queryKey: ['cxp-documento', ...(selectedKey ?? [])],
    queryFn: () => api.cxpGetDocumento(selectedKey![0], selectedKey![1], selectedKey![2], selectedKey![3]),
    enabled: !!selected,
    staleTime: 0,
  })

  // Nombre de cada cuenta de la Distribución Contable -- el detalle solo
  // trae el código (ej. "1104-01"), se resuelve contra el catálogo (CNT)
  // para que se lea igual que en Entrada de Documentos (que ya lo hace).
  const cuentasEnUso = Array.from(new Set((detalle?.lineas ?? []).map((l) => l.cuenta).filter(Boolean)))
  const { data: nombresCuenta = {} } = useQuery<Record<string, string>>({
    queryKey: ['cxp-documento-cuentas', cuentasEnUso.join(',')],
    queryFn: async () => {
      const entries = await Promise.all(
        cuentasEnUso.map(async (c) => {
          try {
            const r: any = await api.cntGetCuenta(c)
            return [c, r?.descripcion || r?.nombre || ''] as const
          } catch {
            return [c, ''] as const
          }
        })
      )
      return Object.fromEntries(entries)
    },
    enabled: cuentasEnUso.length > 0,
    staleTime: 5 * 60_000,
  })

  const totalPages = Math.max(1, Math.ceil(data.length / PAGE))
  const slice = data.slice((page - 1) * PAGE, page * PAGE)

  function exportExcel() {
    downloadCsv(data.map(r => ({
      Tipo: TIPO_DOC[r.tipo_docu] ?? r.tipo_docu, No: r.no_docu,
      Proveedor: r.nombre_proveedor,
      Fecha: fmtDate(r.fecha), Vence: fmtDate(r.fecha_vence),
      'Valor Original': r.valor_original, Saldo: r.saldo,
      'Días Vencidos': diasVencidos(r.fecha_vence) ?? 0,
      Estado: STATUS_MAP[r.status]?.label ?? r.status,
    })), 'cxp-documentos.csv')
  }

  if (!noCia) {
    return <p className="text-muted-foreground py-8 text-center">Seleccione una empresa para ver los documentos.</p>
  }

  const statusInfo = (s: string) => STATUS_MAP[s] ?? { label: s, cls: 'bg-gray-100 text-gray-600' }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="No. Proveedor"
            value={noProveedor}
            onChange={e => { setNoProveedor(e.target.value); setPage(1) }}
            className="w-32"
          />
          <select className="border rounded px-3 py-2 text-sm" value={tipo} onChange={e => { setTipo(e.target.value); setPage(1) }}>
            <option value="">Todos los tipos</option>
            <option value="FP">Factura Proveedor</option>
            <option value="FT">Factura</option>
            <option value="NC">Nota de Crédito</option>
            <option value="ND">Nota de Débito</option>
            <option value="SO">Solicitud de Cheque</option>
            <option value="AC">Ajuste Crédito</option>
            <option value="AD">Ajuste Débito</option>
            <option value="BD">Balance Débito</option>
            <option value="BC">Balance Crédito</option>
          </select>
          <Input
            placeholder="No. Documento"
            value={noDoc}
            onChange={e => { setNoDoc(e.target.value); setPage(1) }}
            className="w-32 font-mono"
          />
          <Input
            placeholder="NCF"
            value={ncf}
            onChange={e => { setNcf(e.target.value); setPage(1) }}
            className="w-36 font-mono"
          />
          <div className="flex items-center gap-1 text-sm"><span className="text-muted-foreground whitespace-nowrap">Desde:</span><Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="w-36" /></div>
          <div className="flex items-center gap-1 text-sm"><span className="text-muted-foreground whitespace-nowrap">Hasta:</span><Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="w-36" /></div>
          <select className="border rounded px-3 py-2 text-sm" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
            <option value="A">Abiertos</option>
            <option value="C">Cerrados</option>
            <option value="P">Parciales</option>
            <option value="V">Vencidos</option>
            <option value="R">Reversados</option>
            <option value="">Todos</option>
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={exportExcel}>Excel</Button>
      </div>

      {status === 'A' && (
        <p className="text-xs text-muted-foreground -mt-2">
          Solo se muestran documentos abiertos. Los reversados quedan ocultos con este filtro; si nota huecos en la secuencia de números, cambie el estado a "Reversados" o "Todos" para verlos.
        </p>
      )}

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>No</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Vence</TableHead>
              <TableHead className="text-right">Días</TableHead>
              <TableHead className="text-right">Valor Original</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
            ) : isError ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-red-500">Error al cargar documentos. Intente nuevamente.</TableCell></TableRow>
            ) : slice.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                {noProveedor || tipo || desde || hasta
                  ? 'No se encontraron documentos con los filtros actuales.'
                  : status === 'A'
                    ? 'No hay documentos abiertos. Pruebe seleccionando "Todos" en el filtro de estado.'
                    : 'Sin documentos.'}
              </TableCell></TableRow>
            ) : slice.map((d, idx) => {
              const key = `${d.no_cia}|${d.punto}|${d.tipo_docu}|${d.no_docu}`
              const si = statusInfo(d.status)
              const dias = diasVencidos(d.fecha_vence)
              const isNew = (page - 1) * PAGE + idx < newHl
              return (
                <TableRow key={key} className={cn("cursor-pointer hover:bg-muted/50", isNew && HIGHLIGHT_ROW_CLASS)} onClick={() => setSelected(key)}>
                  <TableCell>
                    <Badge variant="outline" title={TIPO_DOC[d.tipo_docu] ?? d.tipo_docu}>
                      {d.tipo_docu}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{d.no_docu}</TableCell>
                  <TableCell className="max-w-[180px] truncate" title={d.nombre_proveedor}>{d.nombre_proveedor}</TableCell>
                  <TableCell className="text-xs">{fmtDate(d.fecha)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(d.fecha_vence)}</TableCell>
                  <TableCell className="text-right text-xs">
                    {dias != null ? (
                      <span className={dias > 90 ? 'text-red-700 font-semibold' : dias > 30 ? 'text-orange-600' : 'text-yellow-700'}>
                        {dias}d
                      </span>
                    ) : ''}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt(d.valor_original)}</TableCell>
                  <TableCell className={`text-right font-mono text-sm ${d.saldo < 0 ? 'text-red-600' : ''}`}>{fmt(d.saldo)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Badge className={si.cls}>{si.label}</Badge>
                      {d.pago_bloqueado && d.pago_bloqueado !== 'N' && (
                        <Badge className="bg-red-100 text-red-700 text-xs">Bloqueado</Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm items-center">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <span>Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
        </div>
      )}

      <DocumentoDetalleSheet
        open={!!selected}
        onOpenChange={o => { if (!o) { setSelected(null); setVerHistorial(false) } }}
        title={detalle ? `${TIPO_DOC[detalle.tipo_docu] ?? detalle.tipo_docu} ${detalle.no_docu} — ${detalle.nombre_proveedor}` : 'Cargando…'}
      >
          {detalle && (
            <>
              <section className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Datos del documento</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <Field label="Fecha" value={fmtDate(detalle.fecha)} />
                  <Field label="Vence" value={fmtDate(detalle.fecha_vence)} />
                  <Field label="NCF" value={detalle.ncf_dgi || composeNcfDgi(detalle.posiciones_fijas_ncf, detalle.ncf) || '—'} mono />
                  <Field label="RNC" value={detalle.rnc} mono />
                  <Field label="Creado por" value={detalle.usuario || '—'} />
                </div>
                <Field label="Concepto / Detalle" value={detalle.detalle || '—'} />
              </section>
              <section className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Montos</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <Field label="Valor Original" value={fmt(detalle.valor_original)} mono />
                  <Field label="Saldo" value={fmt(detalle.saldo)} mono className={detalle.saldo < 0 ? 'text-red-600' : ''} />
                  <Field label="ITBIS" value={fmt(detalle.impuesto)} mono />
                  <Field label="ITBIS Retenido" value={fmt(detalle.itbis_retenido)} mono />
                  <Field label="ISR Retenido" value={fmt(detalle.isr_retenido)} mono />
                </div>
              </section>
              {(detalle.pago_bloqueado && detalle.pago_bloqueado !== 'N') || (detalle.status === 'R' && detalle.tipo_docu_r && detalle.no_docu_r) ? (
                <section className="space-y-2 border-t pt-4">
                  {detalle.pago_bloqueado && detalle.pago_bloqueado !== 'N' && (
                    <Badge className="bg-red-100 text-red-700">Pago Bloqueado</Badge>
                  )}
                  {detalle.status === 'R' && detalle.tipo_docu_r && detalle.no_docu_r && (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-100 text-purple-700">Reversado</Badge>
                      <span className="text-muted-foreground">Generó:</span>
                      <button
                        type="button"
                        className="font-mono text-primary underline underline-offset-2"
                        onClick={() => {
                          setTipo(detalle.tipo_docu_r!)
                          setNoDoc(detalle.no_docu_r!)
                          setPage(1)
                          setSelected(null)
                        }}
                      >
                        {TIPO_DOC[detalle.tipo_docu_r] ?? detalle.tipo_docu_r}-{detalle.no_docu_r}
                      </button>
                    </div>
                  )}
                </section>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                {(() => {
                  const editable = esDocumentoEditable(detalle.fecha, periodoQ.periodo) && detalle.status !== 'R'
                  const editBtn = (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!editable}
                      onClick={() =>
                        navigate({
                          to: '/cxp/entrada-documentos',
                          search: { tipo: detalle.tipo_docu, no_docu: detalle.no_docu, cola_id: undefined },
                        })
                      }
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                    </Button>
                  )
                  return editable ? editBtn : (
                    <Tooltip>
                      <TooltipTrigger asChild><span>{editBtn}</span></TooltipTrigger>
                      <TooltipContent>
                        {detalle.status === 'R'
                          ? 'Documento reversado, no se puede editar.'
                          : 'Este documento pertenece a un periodo contable ya cerrado.'}
                      </TooltipContent>
                    </Tooltip>
                  )
                })()}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const tipo = (detalle.tipo_docu || '').toUpperCase()
                    const codigoMap: Record<string, string> = {
                      FP: 'cxp-factura-proveedor',
                      FT: 'cxp-factura-proveedor',
                      AC: 'cxp-ajuste-credito',
                      AD: 'cxp-ajuste-debito',
                      BD: 'cxp-balance-debito',
                      NC: 'cxp-nota-credito',
                      ND: 'cxp-nota-debito',
                      SO: 'cxp-solicitud-cheque',
                    }
                    const codigo = codigoMap[tipo]
                    if (!codigo) {
                      alert(`Imprimir no disponible para el tipo ${tipo}`)
                      return
                    }
                    const qs = new URLSearchParams({
                      no_cia: detalle.no_cia,
                      punto: detalle.punto,
                    }).toString()
                    window.open(
                      `/print/${codigo}/${encodeURIComponent(tipo)}-${encodeURIComponent(detalle.no_docu)}?${qs}`,
                      '_blank',
                    )
                  }}
                >
                  Imprimir / PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setVerHistorial(v => !v)}
                >
                  <History className="mr-1 h-3.5 w-3.5" /> {verHistorial ? 'Ocultar historial' : 'Ver historial'}
                </Button>
              </div>
              {verHistorial && (
                <DocumentoHistorial
                  modulo="CXP"
                  noCia={detalle.no_cia} punto={detalle.punto}
                  tipoDocumento={detalle.tipo_docu} noDocumento={detalle.no_docu}
                  usuarioDoc={detalle.usuario}
                />
              )}
              {detalle.lineas?.length > 0 && (
                <section className="space-y-3 border-t pt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Distribución Contable</h4>
                  <div className="rounded-lg border overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead className="py-3">Cuenta</TableHead>
                          <TableHead className="py-3">Nombre Cuenta</TableHead>
                          <TableHead className="py-3">Tipo</TableHead>
                          <TableHead className="py-3 text-right">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detalle.lineas.map((l, i) => (
                          <TableRow key={i}>
                            <TableCell className="py-2.5 font-mono text-sm">{l.cuenta}</TableCell>
                            <TableCell className="py-2.5 text-sm text-muted-foreground">
                              {nombresCuenta[l.cuenta] ?? '…'}
                            </TableCell>
                            <TableCell className="py-2.5 text-sm">
                              {l.tipo_movi === 'D' ? 'Débito' : l.tipo_movi === 'C' ? 'Crédito' : l.tipo_movi}
                            </TableCell>
                            <TableCell className="py-2.5 text-right font-mono text-sm">{fmt(l.monto)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              )}
            </>
          )}
      </DocumentoDetalleSheet>
    </div>
  )
}

// Par etiqueta/valor del detalle del documento -- etiqueta pequeña arriba,
// valor debajo, mismo patrón visual para todos los campos del panel.
function Field({ label, value, mono, className }: { label: string; value: ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`${mono ? 'font-mono' : ''} ${className ?? ''}`}>{value}</div>
    </div>
  )
}

