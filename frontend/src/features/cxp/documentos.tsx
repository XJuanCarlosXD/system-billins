import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { downloadCsv } from '@/lib/csv-utils'

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
  rnc: string; posiciones_fijas_ncf: string; forma_pago: number
  debito: number; credito: number
}

const TIPO_DOC: Record<string, string> = {
  FP: 'Factura Proveedor',
  NC: 'Nota de Crédito',
  ND: 'Nota de Débito',
  SO: 'Solicitud de Cheque',
  AC: 'Ajuste Crédito',
  AD: 'Ajuste Débito',
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  A: { label: 'Abierto',   cls: 'bg-green-100 text-green-800' },
  C: { label: 'Cerrado',   cls: 'bg-gray-100 text-gray-600' },
  P: { label: 'Parcial',   cls: 'bg-blue-100 text-blue-800' },
  V: { label: 'Vencido',   cls: 'bg-red-100 text-red-700' },
  B: { label: 'Bloqueado', cls: 'bg-orange-100 text-orange-700' },
}

const fmt = (n: number) => n?.toLocaleString('es-DO', { minimumFractionDigits: 2 }) ?? '0.00'
const fmtDate = (s: string) => s ? s.split('-').reverse().join('/') : ''
const PAGE = 50

function diasVencidos(fechaVence: string): number | null {
  if (!fechaVence) return null
  const vence = new Date(fechaVence)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const diff = Math.floor((hoy.getTime() - vence.getTime()) / 86400000)
  return diff > 0 ? diff : null
}

export function CxpDocumentos() {
  const { selectedCompany: noCia, selectedPoint: punto } = useCompany()
  const [noProveedor, setNoProveedor] = useState('')
  const [tipo, setTipo] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [status, setStatus] = useState('A')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)

  const enabled = !!noCia

  const { data = [], isLoading, isError } = useQuery<Documento[]>({
    queryKey: ['cxp-documentos', noCia, punto, noProveedor, tipo, desde, hasta, status],
    queryFn: () => api.cxpListDocumentos({ no_cia: noCia, punto, no_proveedor: noProveedor, tipo, desde, hasta, status }),
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
            <option value="NC">Nota de Crédito</option>
            <option value="ND">Nota de Débito</option>
            <option value="SO">Solicitud de Cheque</option>
            <option value="AC">Ajuste Crédito</option>
            <option value="AD">Ajuste Débito</option>
          </select>
          <div className="flex items-center gap-1 text-sm"><span className="text-muted-foreground whitespace-nowrap">Desde:</span><Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="w-36" /></div>
          <div className="flex items-center gap-1 text-sm"><span className="text-muted-foreground whitespace-nowrap">Hasta:</span><Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="w-36" /></div>
          <select className="border rounded px-3 py-2 text-sm" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
            <option value="A">Abiertos</option>
            <option value="C">Cerrados</option>
            <option value="P">Parciales</option>
            <option value="V">Vencidos</option>
            <option value="">Todos</option>
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={exportExcel}>Excel</Button>
      </div>

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
            ) : slice.map(d => {
              const key = `${d.no_cia}|${d.punto}|${d.tipo_docu}|${d.no_docu}`
              const si = statusInfo(d.status)
              const dias = diasVencidos(d.fecha_vence)
              return (
                <TableRow key={key} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(key)}>
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

      <Sheet open={!!selected} onOpenChange={o => { if (!o) setSelected(null) }}>
        <SheetContent className="max-w-[70vw] max-h-[70vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {detalle ? `${TIPO_DOC[detalle.tipo_docu] ?? detalle.tipo_docu} ${detalle.no_docu} — ${detalle.nombre_proveedor}` : 'Cargando…'}
            </SheetTitle>
          </SheetHeader>
          {detalle && (
            <div className="mt-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Fecha:</span> {fmtDate(detalle.fecha)}</div>
                <div><span className="text-muted-foreground">Vence:</span> {fmtDate(detalle.fecha_vence)}</div>
                <div><span className="text-muted-foreground">NCF:</span> {detalle.posiciones_fijas_ncf || detalle.ncf}</div>
                <div><span className="text-muted-foreground">RNC:</span> {detalle.rnc}</div>
                <div><span className="text-muted-foreground">Valor Original:</span> {fmt(detalle.valor_original)}</div>
                <div><span className="text-muted-foreground">Saldo:</span> {fmt(detalle.saldo)}</div>
                <div><span className="text-muted-foreground">ITBIS:</span> {fmt(detalle.impuesto)}</div>
                <div><span className="text-muted-foreground">ITBIS Retenido:</span> {fmt(detalle.itbis_retenido)}</div>
                <div><span className="text-muted-foreground">ISR Retenido:</span> {fmt(detalle.isr_retenido)}</div>
                {detalle.pago_bloqueado && detalle.pago_bloqueado !== 'N' && (
                  <div className="col-span-2">
                    <Badge className="bg-red-100 text-red-700">Pago Bloqueado</Badge>
                  </div>
                )}
              </div>
              {detalle.lineas?.length > 0 && (
                <div>
                  <p className="font-semibold mb-2">Distribución Contable</p>
                  <div className="rounded border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cuenta</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detalle.lineas.map((l, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{l.cuenta}</TableCell>
                            <TableCell className="text-xs">
                              {l.tipo_movi === 'D' ? 'Débito' : l.tipo_movi === 'C' ? 'Crédito' : l.tipo_movi}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">{fmt(l.monto)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
