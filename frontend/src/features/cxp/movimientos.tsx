import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Printer, FileSpreadsheet } from 'lucide-react'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DocumentoDetalleSheet } from '@/features/documentos/documento-detalle-sheet'
import { downloadCsv } from '@/lib/csv-utils'
import { ProveedorPicker } from './cxp-procesos'
import { TIPO_DOC, fmt, fmtDate, cxpDocKey, useCxpDocumentoDetalle, CxpDocumentoDetalleContent } from './cxp-documento-panel'

interface ProveedorSel { no_proveedor: string; nombre: string; rnc: string; direccion: string }

interface ProvCuenta {
  no_proveedor: string; nombre: string; rnc: string
  categoria: string; clasificacion: string
  balance: number; compras_acumuladas: number; pagos_acumulados: number
  fecha_ultima_compra: string; fecha_ultimo_pago: string
}

interface Movimiento {
  tipo_docu: string; no_docu: string; tipo_movi: string
  fecha: string; cheque: number
  valor_original: number; debito: number; credito: number
}

const PAGE = 50

// La API devuelve tipo_movi como 'D'/'C' (una letra), no la palabra completa.
function tipoMoviLabel(tipoMovi: string): string {
  const t = (tipoMovi || '').trim().toUpperCase()
  return t === 'C' ? 'Crédito' : t === 'D' ? 'Débito' : tipoMovi
}

function isoToday() { return new Date().toISOString().slice(0, 10) }
function isoFirstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function CxpMovimientos() {
  const { selectedCompany: noCia, selectedPoint: punto } = useCompany()
  const [proveedor, setProveedor] = useState<ProveedorSel | null>(null)
  const noProveedor = proveedor?.no_proveedor ?? ''
  const [desde, setDesde] = useState(isoFirstOfMonth())
  const [hasta, setHasta] = useState(isoToday())
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)

  const { data: cuenta } = useQuery<ProvCuenta>({
    queryKey: ['cxp-cuenta', noCia, punto, noProveedor],
    queryFn: () => api.cxpGetProveedorCuenta(noProveedor, noCia || '', punto || ''),
    enabled: !!noCia && !!noProveedor,
  })

  const { data: movs = [], isLoading } = useQuery<Movimiento[]>({
    queryKey: ['cxp-movimientos', noCia, punto, noProveedor, desde, hasta],
    queryFn: () => api.cxpListMovimientosProveedor(noProveedor, noCia || '', punto || '', desde, hasta),
    enabled: !!noCia && !!noProveedor,
  })

  const { data: detalle } = useCxpDocumentoDetalle(selected)

  // El backend a veces trae debito=0 y credito=0 con el monto real solo en
  // valor_original (documentos que se contabilizaron sin desglosar en esas
  // dos columnas) -- sin derivarlo por tipo_movi, esas filas se ven "en 0"
  // en vez del monto real, y el balance corrido queda mal.
  const movsNorm = useMemo(() => movs.map(m => {
    const d = Number(m.debito || 0)
    const c = Number(m.credito || 0)
    if (d > 0 || c > 0) return m
    const valor = Number(m.valor_original || 0)
    const tipo = (m.tipo_movi || '').trim().toUpperCase()
    return { ...m, debito: tipo === 'D' ? valor : 0, credito: tipo === 'C' ? valor : 0 }
  }), [movs])

  // El balance corrido depende del orden completo del período -- se calcula
  // sobre TODOS los movimientos filtrados y luego se pagina, nunca al revés
  // (paginar primero rompería el balance de cada página).
  const movsConBalance = useMemo(() => (
    movsNorm.reduce<(Movimiento & { balance: number })[]>((acc, m) => {
      const prevBal = acc.length ? acc[acc.length - 1].balance : 0
      acc.push({ ...m, balance: prevBal + m.credito - m.debito })
      return acc
    }, [])
  ), [movsNorm])

  const totalDeb = movsNorm.reduce((s, m) => s + (m.debito || 0), 0)
  const totalCred = movsNorm.reduce((s, m) => s + (m.credito || 0), 0)
  const totalPages = Math.max(1, Math.ceil(movsConBalance.length / PAGE))
  const slice = movsConBalance.slice((page - 1) * PAGE, page * PAGE)

  function exportarExcel() {
    downloadCsv(movsConBalance.map(m => ({
      'Tipo Doc': TIPO_DOC[m.tipo_docu] ?? m.tipo_docu, 'No. Doc': m.no_docu, 'Tipo Mov': tipoMoviLabel(m.tipo_movi),
      'Fecha': fmtDate(m.fecha), 'Cheque': m.cheque || '',
      'Débito': fmt(m.debito), 'Crédito': fmt(m.credito), 'Balance': fmt(m.balance),
    })), `cxp-movimientos-${noProveedor}.csv`)
  }

  function imprimirPdf() {
    const qs = new URLSearchParams({
      no_cia: noCia || '', punto: punto || '', desde, hasta, no_proveedor: noProveedor,
    }).toString()
    window.open(`/print/cxp-rep-mayor/${encodeURIComponent(noProveedor)}?${qs}`, '_blank')
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Movimientos de Proveedor</h3>
        <p className="text-sm text-muted-foreground">
          Mayor auxiliar del proveedor: cada documento que le debita o acredita la cuenta, con balance corrido. Haga clic en una fila para ver el documento completo.
        </p>
      </div>

      <div className="space-y-3">
        <ProveedorPicker value={proveedor} onChange={p => { setProveedor(p); setPage(1) }} />
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={desde} onChange={e => { setDesde(e.target.value); setPage(1) }} className="w-36 h-9" />
          </div>
          <div>
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={hasta} onChange={e => { setHasta(e.target.value); setPage(1) }} className="w-36 h-9" />
          </div>
          {noProveedor && (
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" className="h-9" onClick={exportarExcel} disabled={!movs.length}>
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
              </Button>
              <Button variant="outline" size="sm" className="h-9" onClick={imprimirPdf} disabled={!movs.length}>
                <Printer className="h-4 w-4 mr-1" /> Imprimir PDF
              </Button>
            </div>
          )}
        </div>
      </div>

      {cuenta && (
        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Proveedor</p>
              <p className="font-semibold">{cuenta.no_proveedor} — {cuenta.nombre}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Clase</p>
              <p className="text-sm">{cuenta.clasificacion || cuenta.categoria || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Balance Total</p>
              <p className="font-bold text-blue-700">{fmt(cuenta.balance)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Compras Acum.</p>
              <p className="text-sm">{fmt(cuenta.compras_acumuladas)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pagos Acum.</p>
              <p className="text-sm">{fmt(cuenta.pagos_acumulados)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ú. Compra / Ú. Pago</p>
              <p className="text-sm">{fmtDate(cuenta.fecha_ultima_compra)} / {fmtDate(cuenta.fecha_ultimo_pago)}</p>
            </div>
          </div>
        </div>
      )}

      {noProveedor && isLoading && <Skeleton className="h-64 w-full" />}

      {noProveedor && !isLoading && (
        <>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Movimiento</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Cheque</TableHead>
                  <TableHead className="text-right">Débito</TableHead>
                  <TableHead className="text-right">Crédito</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movsConBalance.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    No hay movimientos para el proveedor {noProveedor} entre {fmtDate(desde)} y {fmtDate(hasta)}.
                  </TableCell></TableRow>
                )}
                {slice.map(m => {
                  const key = cxpDocKey({ no_cia: noCia || '', punto: punto || '', tipo_docu: m.tipo_docu, no_docu: m.no_docu })
                  return (
                    <TableRow
                      key={`${m.tipo_docu}-${m.no_docu}`}
                      className="text-sm cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelected(key)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" title={TIPO_DOC[m.tipo_docu] ?? m.tipo_docu} className="shrink-0">
                            {m.tipo_docu}
                          </Badge>
                          <span className="font-mono text-xs">{m.no_docu}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          m.tipo_movi?.trim().toUpperCase() === 'C' ? 'border-emerald-300 text-emerald-700' : 'border-red-300 text-red-700'
                        }>
                          {tipoMoviLabel(m.tipo_movi)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{fmtDate(m.fecha)}</TableCell>
                      <TableCell className="text-right text-xs font-mono">{m.cheque > 0 ? m.cheque : '—'}</TableCell>
                      <TableCell className="text-right font-mono text-red-700">{m.debito > 0 ? fmt(m.debito) : ''}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-700">{m.credito > 0 ? fmt(m.credito) : ''}</TableCell>
                      <TableCell className={`text-right font-mono font-medium ${m.balance > 0 ? 'text-blue-700' : m.balance < 0 ? 'text-green-700' : ''}`}>
                        {fmt(Math.abs(m.balance))}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {movsConBalance.length > 0 && (
                  <TableRow className="bg-muted/50 font-semibold border-t-2">
                    <TableCell colSpan={4} className="text-right text-sm">Totales período ({movsConBalance.length} movimiento{movsConBalance.length === 1 ? '' : 's'}):</TableCell>
                    <TableCell className="text-right font-mono text-red-700">{fmt(totalDeb)}</TableCell>
                    <TableCell className="text-right font-mono text-emerald-700">{fmt(totalCred)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{fmt(Math.abs(totalCred - totalDeb))}</TableCell>
                  </TableRow>
                )}
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
        </>
      )}

      {!noProveedor && (
        <div className="text-center text-muted-foreground py-16">
          <p className="text-base font-medium">Movimientos de Proveedores</p>
          <p className="text-sm mt-1">Busque un proveedor (código o lupa) para ver su historial de movimientos</p>
        </div>
      )}

      <DocumentoDetalleSheet
        open={!!selected}
        onOpenChange={o => { if (!o) setSelected(null) }}
        title={detalle ? `${TIPO_DOC[detalle.tipo_docu] ?? detalle.tipo_docu} ${detalle.no_docu} — ${detalle.nombre_proveedor}` : 'Cargando…'}
      >
        {detalle && (
          <CxpDocumentoDetalleContent key={selected} detalle={detalle} onNavigate={setSelected} />
        )}
      </DocumentoDetalleSheet>
    </div>
  )
}
