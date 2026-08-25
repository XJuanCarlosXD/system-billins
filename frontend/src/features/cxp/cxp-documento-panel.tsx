import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { History, Pencil } from 'lucide-react'
import { api } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DocumentoHistorial } from '@/features/historial/documento-historial'
import { esDocumentoEditable, usePeriodoActualCxP } from './corregir-documento-dialog'

// Panel de detalle de UN documento CxP, compartido por Consulta de
// Documentos (documentos.tsx) y Movimientos de Proveedor (movimientos.tsx)
// para que ambas pantallas ofrezcan exactamente las mismas acciones
// (Editar / Imprimir / Historial / Aplicaciones) en vez de duplicar ~150
// líneas de JSX que divergen con el tiempo.

export const TIPO_DOC: Record<string, string> = {
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

export const fmt = (n: number) => n?.toLocaleString('es-DO', { minimumFractionDigits: 2 }) ?? '0.00'
export const fmtDate = (s: string) => s ? s.split('-').reverse().join('/') : ''

// NCF DGI real: prefijo + LPAD(NCF). Tradicional (B01..B15) usa 8 dígitos
// (total 11). e-CF (E31/E32) usa 10 dígitos (total 13).
export function composeNcfDgi(prefix: string | null | undefined, ncf: number | null | undefined): string {
  const p = (prefix || '').trim().toUpperCase()
  const n = typeof ncf === 'number' ? ncf : Number(ncf)
  if (!p || !n || n <= 0) return p || (n ? String(n) : '')
  const width = p.startsWith('E') ? 10 : 8
  return `${p}${String(n).padStart(width, '0')}`
}

export interface AplicacionRef {
  tipo_doc: string; no_doc: string; no_cuota?: number
  monto: number; fecha: string; valor_original: number; saldo: number
}

export interface CxpDocDetalle {
  no_cia: string; punto: string; tipo_docu: string; no_docu: string
  no_proveedor: string; nombre_proveedor: string
  fecha: string; fecha_vence: string
  valor_original: number; saldo: number; status: string
  ncf: number | null; posiciones_fijas_ncf: string; rnc: string; ncf_dgi?: string; forma_pago: number
  debito: number; credito: number
  tipo_transaccion: string; tipo_movi: string
  impuesto: number; itbis_retenido: number; isr_retenido: number
  pago_bloqueado: string
  tipo_gasto?: string | null; tipo_retencion?: number | null
  tipo_docu_r?: string | null; no_docu_r?: string | null
  usuario?: string | null
  detalle?: string | null
  lineas: { cuenta: string; monto: number; tipo_movi: string }[]
  debitos_aplicados?: AplicacionRef[]
  documentos_afectados?: AplicacionRef[]
}

export function cxpDocKey(d: { no_cia: string; punto: string; tipo_docu: string; no_docu: string }) {
  return `${d.no_cia}|${d.punto}|${d.tipo_docu}|${d.no_docu}`
}

export function useCxpDocumentoDetalle(selected: string | null) {
  const [noCia, punto, tipoDocu, noDocu] = selected ? selected.split('|') : [undefined, undefined, undefined, undefined]
  return useQuery<CxpDocDetalle>({
    queryKey: ['cxp-documento', noCia, punto, tipoDocu, noDocu],
    queryFn: () => api.cxpGetDocumento(noCia!, punto!, tipoDocu!, noDocu!),
    enabled: !!selected,
    staleTime: 0,
  })
}

const CODIGO_PDF: Record<string, string> = {
  FP: 'cxp-factura-proveedor',
  FT: 'cxp-factura-proveedor',
  AC: 'cxp-ajuste-credito',
  AD: 'cxp-ajuste-debito',
  BD: 'cxp-balance-debito',
  NC: 'cxp-nota-credito',
  ND: 'cxp-nota-debito',
  SO: 'cxp-solicitud-cheque',
}

export function CxpDocumentoDetalleContent({
  detalle, onNavigate,
}: {
  detalle: CxpDocDetalle
  /** Abre en el mismo panel otro documento (referencia/aplicación/reverso) sin cerrar el sheet. */
  onNavigate: (key: string) => void
}) {
  const navigate = useNavigate()
  const [verHistorial, setVerHistorial] = useState(false)
  const periodoQ = usePeriodoActualCxP(detalle.no_cia, detalle.punto)

  const cuentasEnUso = Array.from(new Set((detalle.lineas ?? []).map((l) => l.cuenta).filter(Boolean)))
  const { data: nombresCuenta = {} } = useQuery<Record<string, string>>({
    queryKey: ['cxp-documento-cuentas', cuentasEnUso.join(',')],
    queryFn: async () => {
      const entries = await Promise.all(
        cuentasEnUso.map(async (c) => {
          try {
            const r = await api.cntGetCuenta(c) as { descripcion?: string; nombre?: string } | null
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

  const aplicaciones = detalle.debitos_aplicados ?? detalle.documentos_afectados ?? []
  const aplicacionesTitulo = detalle.debitos_aplicados
    ? 'Débitos Aplicados (ND/AD/BD) a este documento'
    : 'Documentos que Afectó (facturas/créditos pagados)'

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

  return (
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
                onClick={() => onNavigate(`${detalle.no_cia}|${detalle.punto}|${detalle.tipo_docu_r}|${detalle.no_docu_r}`)}
              >
                {TIPO_DOC[detalle.tipo_docu_r] ?? detalle.tipo_docu_r}-{detalle.no_docu_r}
              </button>
            </div>
          )}
        </section>
      ) : null}

      {aplicaciones.length > 0 && (
        <section className="space-y-3 border-t pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{aplicacionesTitulo}</h4>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="py-2">Documento</TableHead>
                  <TableHead className="py-2">Fecha</TableHead>
                  <TableHead className="py-2 text-right">Monto Aplicado</TableHead>
                  <TableHead className="py-2 text-right">Saldo Actual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aplicaciones.map((a, i) => (
                  <TableRow key={i}>
                    <TableCell className="py-2">
                      <button
                        type="button"
                        className="font-mono text-sm text-primary underline underline-offset-2"
                        onClick={() => onNavigate(`${detalle.no_cia}|${detalle.punto}|${a.tipo_doc}|${a.no_doc}`)}
                      >
                        {TIPO_DOC[a.tipo_doc] ?? a.tipo_doc}-{a.no_doc}
                      </button>
                    </TableCell>
                    <TableCell className="py-2 text-sm">{fmtDate(a.fecha)}</TableCell>
                    <TableCell className="py-2 text-right font-mono text-sm">{fmt(a.monto)}</TableCell>
                    <TableCell className="py-2 text-right font-mono text-sm">{fmt(a.saldo)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        {editable ? editBtn : (
          <Tooltip>
            <TooltipTrigger asChild><span>{editBtn}</span></TooltipTrigger>
            <TooltipContent>
              {detalle.status === 'R'
                ? 'Documento reversado, no se puede editar.'
                : 'Este documento pertenece a un periodo contable ya cerrado.'}
            </TooltipContent>
          </Tooltip>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const tipo = (detalle.tipo_docu || '').toUpperCase()
            const codigo = CODIGO_PDF[tipo]
            if (!codigo) {
              alert(`Imprimir no disponible para el tipo ${tipo}`)
              return
            }
            const qs = new URLSearchParams({ no_cia: detalle.no_cia, punto: detalle.punto }).toString()
            window.open(`/print/${codigo}/${encodeURIComponent(tipo)}-${encodeURIComponent(detalle.no_docu)}?${qs}`, '_blank')
          }}
        >
          Imprimir / PDF
        </Button>
        <Button size="sm" variant="outline" onClick={() => setVerHistorial(v => !v)}>
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
                    <TableCell className="py-2.5 text-sm text-muted-foreground">{nombresCuenta[l.cuenta] ?? '…'}</TableCell>
                    <TableCell className={`py-2.5 text-sm ${l.tipo_movi === 'D' ? 'text-red-700' : l.tipo_movi === 'C' ? 'text-emerald-700' : ''}`}>{l.tipo_movi === 'D' ? 'Débito' : l.tipo_movi === 'C' ? 'Crédito' : l.tipo_movi}</TableCell>
                    <TableCell className="py-2.5 text-right font-mono text-sm">{fmt(l.monto)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </>
  )
}

function Field({ label, value, mono, className }: { label: string; value: ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`${mono ? 'font-mono' : ''} ${className ?? ''}`}>{value}</div>
    </div>
  )
}
