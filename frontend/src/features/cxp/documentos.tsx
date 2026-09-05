import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DocumentoDetalleSheet } from '@/features/documentos/documento-detalle-sheet'
import { downloadCsv } from '@/lib/csv-utils'
import { cn } from '@/lib/utils'
import { HIGHLIGHT_ROW_CLASS } from '@/lib/sidebar-badges'
import { useDocHighlightCount } from '@/hooks/use-sidebar-badges'
import { TIPO_DOC, fmt, fmtDate, cxpDocKey, useCxpDocumentoDetalle, CxpDocumentoDetalleContent } from './cxp-documento-panel'

interface Documento {
  no_cia: string; punto: string; tipo_docu: string; no_docu: string
  no_proveedor: string; nombre_proveedor: string
  fecha: string; fecha_vence: string
  valor_original: number; saldo: number; status: string
  ncf: number | null; tipo_transaccion: string; tipo_movi: string
  impuesto: number; itbis_retenido: number; isr_retenido: number
  pago_bloqueado: string
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  A: { label: 'Abierto',    cls: 'bg-green-100 text-green-800' },
  C: { label: 'Cerrado',    cls: 'bg-gray-100 text-gray-600' },
  P: { label: 'Parcial',    cls: 'bg-blue-100 text-blue-800' },
  V: { label: 'Vencido',    cls: 'bg-red-100 text-red-700' },
  B: { label: 'Bloqueado',  cls: 'bg-orange-100 text-orange-700' },
  R: { label: 'Reversado',  cls: 'bg-purple-100 text-purple-700' },
}

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
  const [noDoc, setNoDoc] = useState('')
  const [ncf, setNcf] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [status, setStatus] = useState('A')
  const [page, setPage] = useState(1)
  const newHl = useDocHighlightCount('cxp')
  const [selected, setSelected] = useState<string | null>(null)

  const enabled = !!noCia

  const { data = [], isLoading, isError } = useQuery<Documento[]>({
    queryKey: ['cxp-documentos', noCia, punto, noProveedor, tipo, noDoc, ncf, desde, hasta, status],
    queryFn: () => api.cxpListDocumentos({ no_cia: noCia, punto, no_proveedor: noProveedor, tipo, no_doc: noDoc, ncf, desde, hasta, status }),
    staleTime: 60_000,
    enabled,
  })

  const { data: detalle } = useCxpDocumentoDetalle(selected)

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
          Solo se muestran documentos con saldo pendiente. Los que ya se saldaron por completo (Cerrados) — por ejemplo una Nota de Débito usada como abono a una factura — o fueron reversados no aparecen aquí. Si no encuentra un documento que acaba de registrar, cambie el filtro Estado a "Cerrados", "Reversados" o "Todos".
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
              const key = cxpDocKey(d)
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

