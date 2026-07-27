import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv } from '@/lib/csv-utils'

interface ProvCuenta {
  no_proveedor: string; nombre: string; rnc: string
  categoria: string; clasificacion: string
  balance: number; compras_acumuladas: number; pagos_acumulados: number
  fecha_ultima_compra: string; fecha_ultimo_pago: string
}

interface CuentaDoc {
  tipo_docu: string; no_docu: string; tipo_movi: string
  fecha: string; fecha_vence: string
  cheque: number; tasa_us: number; descuento: number
  valor_original: number; saldo: number
}

const fmt = (n: number) => n?.toLocaleString('es-DO', { minimumFractionDigits: 2 }) ?? '0.00'
const fmtDate = (s: string) => s ? s.split('-').reverse().join('/') : '—'

function diasVencidos(fechaVence: string): number | null {
  if (!fechaVence) return null
  const diff = Math.floor((Date.now() - new Date(fechaVence).getTime()) / 86400000)
  return diff > 0 ? diff : null
}

export function CxpCuentas() {
  const { selectedCompany: noCia, selectedPoint: punto } = useCompany()
  const [noProveedor, setNoProveedor] = useState('')
  const [input, setInput] = useState('')
  const [tipoMovi, setTipoMovi] = useState('')
  const [enCero, setEnCero] = useState('N')

  const { data: cuenta, isLoading: loadingCuenta } = useQuery<ProvCuenta>({
    queryKey: ['cxp-cuenta', noCia, punto, noProveedor],
    queryFn: () => api.cxpGetProveedorCuenta(noProveedor, noCia || '', punto || ''),
    enabled: !!noCia && !!noProveedor,
  })

  const { data: docs = [], isLoading: loadingDocs } = useQuery<CuentaDoc[]>({
    queryKey: ['cxp-cuentas-docs', noCia, punto, noProveedor, tipoMovi, enCero],
    queryFn: () => api.cxpListCuentasProveedor(noProveedor, noCia || '', punto || '', tipoMovi, enCero),
    enabled: !!noCia && !!noProveedor,
  })

  function buscar() {
    const trimmed = input.trim()
    if (!trimmed) return
    setNoProveedor(trimmed.padStart(6, '0'))
  }

  function exportar() {
    downloadCsv(docs.map(d => ({
      'Tipo Doc': d.tipo_docu, 'No. Doc': d.no_docu, 'Tipo Mov': d.tipo_movi,
      'Fecha': fmtDate(d.fecha), 'F. Vence': fmtDate(d.fecha_vence),
      'Días': diasVencidos(d.fecha_vence) ?? '',
      'Cheque': d.cheque || '', 'Tasa US': d.tasa_us,
      'Val. Original': fmt(d.valor_original), 'Val. Pendiente': fmt(d.saldo),
    })), `cxp-cuentas-${noProveedor}.csv`)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="No. Proveedor (ej: 57 o 000057)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && buscar()}
          className="w-64"
        />
        <Button onClick={buscar} disabled={!input.trim()}>Consultar</Button>
      </div>

      {loadingCuenta && noProveedor && (
        <p className="text-muted-foreground text-sm">Buscando proveedor…</p>
      )}

      {cuenta && (
        <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
          <div className="flex flex-wrap items-start gap-x-8 gap-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Proveedor</p>
              <p className="font-semibold">{cuenta.no_proveedor} — {cuenta.nombre}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Clase</p>
              <p className="text-sm">{cuenta.clasificacion || cuenta.categoria || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">RNC</p>
              <p className="text-sm">{cuenta.rnc || '—'}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t">
            <div>
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className="font-bold text-lg text-blue-700">{fmt(cuenta.balance)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Compras Acumuladas</p>
              <p className="font-medium">{fmt(cuenta.compras_acumuladas)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pagos Acumulados</p>
              <p className="font-medium">{fmt(cuenta.pagos_acumulados)}</p>
            </div>
            <div className="space-y-1">
              <div>
                <p className="text-xs text-muted-foreground">Ú. Compra</p>
                <p className="text-sm">{fmtDate(cuenta.fecha_ultima_compra)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ú. Pago</p>
                <p className="text-sm">{fmtDate(cuenta.fecha_ultimo_pago)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {noProveedor && (
        <div className="flex flex-wrap gap-2 items-center">
          <select className="border rounded px-3 py-1.5 text-sm" value={tipoMovi} onChange={e => setTipoMovi(e.target.value)}>
            <option value="">Todos (Déb + Créd)</option>
            <option value="Debito">Solo Débitos</option>
            <option value="Credito">Solo Créditos</option>
          </select>
          <select className="border rounded px-3 py-1.5 text-sm" value={enCero} onChange={e => setEnCero(e.target.value)}>
            <option value="N">Ocultar saldo cero</option>
            <option value="S">Solo saldo cero</option>
            <option value="">Todos</option>
          </select>
          <Button variant="outline" size="sm" onClick={exportar} disabled={!docs.length}>Excel</Button>
          <span className="text-sm text-muted-foreground ml-auto">{docs.length} documentos</span>
        </div>
      )}

      {noProveedor && (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>No. Doc</TableHead>
                <TableHead>Mov</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>F. Vence</TableHead>
                <TableHead className="text-right">Días</TableHead>
                <TableHead className="text-right">Cheque</TableHead>
                <TableHead className="text-right">Tasa US</TableHead>
                <TableHead className="text-right">Val. Original</TableHead>
                <TableHead className="text-right">Val. Pendiente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingDocs && (
                <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">Cargando…</TableCell></TableRow>
              )}
              {!loadingDocs && docs.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">Sin documentos</TableCell></TableRow>
              )}
              {docs.map(d => {
                const dias = diasVencidos(d.fecha_vence)
                return (
                  <TableRow key={`${d.tipo_docu}-${d.no_docu}`} className="text-sm">
                    <TableCell>
                      <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{d.tipo_docu}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{d.no_docu}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        d.tipo_movi === 'Credito' ? 'border-blue-300 text-blue-700' : 'border-orange-300 text-orange-700'
                      }>
                        {d.tipo_movi === 'Credito' ? 'Crédito' : d.tipo_movi === 'Debito' ? 'Débito' : d.tipo_movi}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{fmtDate(d.fecha)}</TableCell>
                    <TableCell className="text-xs">{fmtDate(d.fecha_vence)}</TableCell>
                    <TableCell className="text-right text-xs">
                      {dias != null ? (
                        <span className={dias > 90 ? 'text-red-700 font-semibold' : dias > 30 ? 'text-orange-600' : 'text-yellow-700'}>
                          {dias}d
                        </span>
                      ) : ''}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">{d.cheque > 0 ? d.cheque : ''}</TableCell>
                    <TableCell className="text-right text-xs">{d.tasa_us > 0 ? fmt(d.tasa_us) : ''}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(d.valor_original)}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(d.saldo)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {!noProveedor && (
        <div className="text-center text-muted-foreground py-16">
          <p className="text-base font-medium">Consulta de Cuentas por Pagar</p>
          <p className="text-sm mt-1">Ingrese el número de proveedor y presione Consultar</p>
        </div>
      )}
    </div>
  )
}
