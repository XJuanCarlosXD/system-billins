// CXC Consultas: estado cuenta, balance, histórico, libro ventas
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, FileDown, Printer, Loader2, FileText, Eye } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { ClientePicker, type Cliente } from '@/components/cxc/cliente-picker'
import './print-estado-cuenta.css'

interface P { noCia: string; punto?: string; mes?: number; ano?: number }

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtInt = (n: any) => Number(n || 0).toLocaleString('es-DO')
const today = new Date().toISOString().slice(0, 10)
const firstOfMonth = today.slice(0, 7) + '-01'
const fmtDate = (s: any) => s ? String(s).slice(0, 10) : ''

const docPrefijoTipo = (tipo: string) => (tipo || '').toString().trim().toUpperCase()
const docCode = (tipo: any, no: any) => {
  const t = docPrefijoTipo(tipo)
  const n = (no || '').toString().trim()
  return t ? `${t}-${n}` : n
}

// Mapeo tipo CxC → código de plantilla PDF registrada en /print/<codigo>/<no>
const CXC_PRINT_CODE: Record<string, string> = {
  RI: 'recibo-cobro',
  NC: 'cxc-nota-credito',
  ND: 'cxc-nota-debito',
  CD: 'cxc-cheque-devuelto',
  AC: 'cxc-ajuste-credito',
  AD: 'cxc-ajuste-debito',
  DV: 'cxc-devolucion',
  AF: 'cxc-anulacion-factura',
  BI: 'cxc-balance-inicial',
}

const printDocCxc = (tipo: any, no: any, noCia: string, punto: string) => {
  const t = docPrefijoTipo(tipo)
  const noStr = (no || '').toString().trim()
  // FC/FT son la factura real (TFAT_FACTURA) — su impresion es la
  // plantilla de factura de FAT (lineas, cliente, totales), no la
  // plantilla generica de documentos CxC ('factura-credito' no existe
  // como codigo registrado, por eso este caso se maneja aparte).
  if (t === 'FC' || t === 'FT') {
    const qs = new URLSearchParams({ no_cia: noCia, punto: punto || '01' }).toString()
    window.open(
      `/print/factura/${encodeURIComponent(`${t}-${noStr}`)}?${qs}`,
      '_blank', 'noopener',
    )
    return
  }
  const code = CXC_PRINT_CODE[t]
  if (!code) {
    alert(`Imprimir no está disponible para el tipo ${t}`)
    return
  }
  const qs = new URLSearchParams({
    no_cia: noCia, punto: punto || '01', tipo_doc: t,
  }).toString()
  window.open(
    `/print/${code}/${encodeURIComponent(noStr)}?${qs}`,
    '_blank', 'noopener',
  )
}

// ─── Estado de Cuenta ─────────────────────────────────────────────────────────
export function CxcEstadoCuenta({ noCia, punto }: P) {
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [fechaCorte, setFechaCorte] = useState(today)
  const [detalleDoc, setDetalleDoc] = useState<any>(null)

  const load = async () => {
    if (!cliente?.no_cliente) return
    setLoading(true)
    try {
      const res = await regalGeneralApi.cxcEstadoCuenta(noCia, String(cliente.no_cliente))
      setData(res)
    } finally { setLoading(false) }
  }

  // Auto-consultar cuando se selecciona un cliente nuevo
  useEffect(() => {
    if (cliente?.no_cliente) load()
    else setData(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente?.no_cliente])

  const agingColor = (dias: number) => {
    if (dias <= 30) return 'text-emerald-700'
    if (dias <= 60) return 'text-yellow-700'
    if (dias <= 90) return 'text-orange-700'
    return 'text-red-700 font-semibold'
  }

  const agingBadge = (dias: number) => {
    if (dias <= 30) return 'Al día'
    if (dias <= 60) return '31–60 d'
    if (dias <= 90) return '61–90 d'
    return '+90 d'
  }

  const handleImprimir = () => {
    if (!cliente?.no_cliente) return
    const qs = new URLSearchParams({ no_cia: noCia, punto: punto || '01', fecha_corte: fechaCorte }).toString()
    window.open(
      `/print/cxc-estado-cuenta/${encodeURIComponent(String(cliente.no_cliente))}?${qs}`,
      '_blank', 'noopener',
    )
  }

  const handleExportCsv = () => {
    if (!data?.documentos?.length) return
    const headers = ['Documento','Tipo','Fecha','Detalle','NCF','Valor','Saldo','Días']
    const rows = data.documentos.map((d: any) => [
      docCode(d.tipo_doc, d.no_doc), d.tipo_label || d.tipo_doc,
      fmtDate(d.fecha), (d.detalle || '').replace(/[,;\n]/g, ' '),
      d.ncf || '', d.valor, d.saldo, d.dias_vencido,
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `estado_cuenta_${cliente?.no_cliente || 'cliente'}_${today}.csv`
    a.click()
  }

  const cli = data?.cliente
  const aging = data?.aging || {}

  return (
    <div className="p-6 space-y-4 print:p-0">
      {/* Header pantalla — se oculta al imprimir */}
      <div className="flex items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Estado de Cuenta</h1>
          <p className="text-sm text-muted-foreground">
            Consulta de saldos abiertos del cliente con envejecimiento de cartera.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleExportCsv}
            disabled={!data?.documentos?.length}
            variant="outline" size="sm"
            className="gap-1"
          >
            <FileDown className="h-4 w-4" /> CSV
          </Button>
          <Button
            onClick={handleImprimir}
            disabled={!data?.documentos?.length}
            variant="outline" size="sm"
            className="gap-1"
          >
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </div>
      </div>

      {/* Filtros — se oculta al imprimir */}
      <div className="space-y-3 rounded-lg border bg-muted/30 p-3 print:hidden">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Cliente</Label>
            <ClientePicker noCia={noCia} cliente={cliente} onChange={setCliente} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fecha de corte</Label>
            <Input
              type="date" value={fechaCorte}
              onChange={(e) => setFechaCorte(e.target.value)}
              className="h-9 w-40"
            />
          </div>
          <Button
            onClick={load} disabled={!cliente || loading}
            size="sm" className="h-9 gap-1"
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Search className="h-4 w-4" />}
            Actualizar
          </Button>
        </div>
      </div>

      {!data && !loading && (
        <div className="rounded-md border-2 border-dashed p-12 text-center text-muted-foreground print:hidden">
          <FileText className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Seleccione un cliente para ver su estado de cuenta.</p>
        </div>
      )}

      {data && (
        <>
          {/* Datos del cliente */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">{cli?.no_cliente}</span>
                {cli?.nombre}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {cli?.rnc && (
                  <div>
                    <div className="text-xs text-muted-foreground">RNC / Cédula</div>
                    <div className="font-mono">{cli.rnc}</div>
                  </div>
                )}
                {cli?.direccion && (
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground">Dirección</div>
                    <div className="truncate" title={cli.direccion}>{cli.direccion}</div>
                  </div>
                )}
                {cli?.telefono && (
                  <div>
                    <div className="text-xs text-muted-foreground">Teléfono</div>
                    <div className="font-mono">{cli.telefono}</div>
                  </div>
                )}
                {cli?.vendedor && (
                  <div>
                    <div className="text-xs text-muted-foreground">Vendedor</div>
                    <div>{cli.vendedor}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-muted-foreground">Límite de crédito</div>
                  <div className="font-mono tabular-nums">RD$ {fmt(cli?.limite)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Plazo</div>
                  <div>{fmtInt(cli?.dias)} días</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPIs y aging */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs text-muted-foreground font-medium">Total pendiente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-xl font-bold tabular-nums ${data.total_pendiente > 0 ? 'text-blue-900 dark:text-blue-200' : 'text-emerald-700'}`}>
                  RD$ {fmt(data.total_pendiente)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs text-muted-foreground font-medium">Al día (0–30)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold text-emerald-700 tabular-nums">RD$ {fmt(aging.d_0_30)}</div>
              </CardContent>
            </Card>
            <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-900">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs text-muted-foreground font-medium">31–60 días</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold text-yellow-700 tabular-nums">RD$ {fmt(aging.d_31_60)}</div>
              </CardContent>
            </Card>
            <Card className="bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs text-muted-foreground font-medium">61–90 días</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold text-orange-700 tabular-nums">RD$ {fmt(aging.d_61_90)}</div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs text-muted-foreground font-medium">+90 días (vencido)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold text-red-700 tabular-nums">RD$ {fmt(aging.d_mas_90)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Tabla de documentos */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Documento</TableHead>
                  <TableHead className="w-32">Tipo</TableHead>
                  <TableHead className="w-24">Fecha</TableHead>
                  <TableHead className="w-32 text-right">Valor</TableHead>
                  <TableHead className="w-32 text-right">Saldo</TableHead>
                  <TableHead className="w-20 text-center">Días</TableHead>
                  <TableHead className="w-24 text-center">Envejec.</TableHead>
                  <TableHead className="w-32">NCF</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="w-24 print:hidden">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                      Cargando…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && (data.documentos || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                      Sin documentos pendientes
                    </TableCell>
                  </TableRow>
                )}
                {!loading && (data.documentos || []).map((d: any) => {
                  const dias = Number(d.dias_vencido) || 0
                  const esCredito = (d.tipo_movi || '').toUpperCase() === 'C'
                  const saldo = Number(d.saldo || 0)
                  return (
                    <TableRow
                      key={`${d.tipo_doc}-${d.no_doc}`}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setDetalleDoc(d)}
                    >
                      <TableCell className="font-mono text-xs">{docCode(d.tipo_doc, d.no_doc)}</TableCell>
                      <TableCell>
                        <Badge variant={esCredito ? 'secondary' : 'outline'} className="text-xs">
                          {d.tipo_label || d.tipo_doc}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">{fmtDate(d.fecha)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{fmt(d.valor)}</TableCell>
                      <TableCell className={`text-right font-mono tabular-nums font-medium ${saldo < 0 ? 'text-emerald-700' : ''}`}>
                        {fmt(saldo)}
                      </TableCell>
                      <TableCell className={`text-center tabular-nums ${agingColor(dias)}`}>{fmtInt(dias)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-[10px] ${agingColor(dias)}`}>
                          {agingBadge(dias)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[11px]">{d.ncf || ''}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate" title={d.detalle}>
                        {d.detalle}
                      </TableCell>
                      <TableCell className="text-right print:hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => setDetalleDoc(d)}
                            title="Ver detalle"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => printDocCxc(d.tipo_doc, d.no_doc, noCia, punto || '01')}
                            title="Imprimir documento"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
              {!loading && (data.documentos || []).length > 0 && (
                <tfoot>
                  <tr className="font-semibold bg-muted/50 border-t-2 text-sm">
                    <td colSpan={4} className="px-3 py-2 text-right">
                      Totales — Débito: <span className="tabular-nums">{fmt(data.total_debito)}</span> · Crédito:{' '}
                      <span className="tabular-nums text-emerald-700">{fmt(data.total_credito)}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold">{fmt(data.total_pendiente)}</td>
                    <td colSpan={5} />
                  </tr>
                </tfoot>
              )}
            </Table>
          </div>
        </>
      )}

      {/* Modal detalle de documento */}
      <Dialog open={!!detalleDoc} onOpenChange={(o) => !o && setDetalleDoc(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documento {docCode(detalleDoc?.tipo_doc, detalleDoc?.no_doc)}
            </DialogTitle>
            <DialogDescription>
              {detalleDoc?.tipo_label || detalleDoc?.tipo_doc} — {cli?.nombre}
            </DialogDescription>
          </DialogHeader>
          {detalleDoc && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Fecha</div>
                  <div className="font-mono tabular-nums">{fmtDate(detalleDoc.fecha)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Días transcurridos</div>
                  <div className={`font-mono tabular-nums ${agingColor(Number(detalleDoc.dias_vencido || 0))}`}>
                    {fmtInt(detalleDoc.dias_vencido)} días — {agingBadge(Number(detalleDoc.dias_vencido || 0))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Valor original</div>
                  <div className="font-mono tabular-nums">RD$ {fmt(detalleDoc.valor)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Saldo actual</div>
                  <div className={`font-mono tabular-nums font-semibold text-base ${Number(detalleDoc.saldo) < 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    RD$ {fmt(detalleDoc.saldo)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Tipo movimiento</div>
                  <div>
                    <Badge variant={(detalleDoc.tipo_movi || '').toUpperCase() === 'C' ? 'secondary' : 'outline'}>
                      {(detalleDoc.tipo_movi || '').toUpperCase() === 'C' ? 'Crédito (CR)' : 'Débito (DR)'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">NCF</div>
                  <div className="font-mono text-xs">{detalleDoc.ncf || '—'}</div>
                </div>
              </div>
              {detalleDoc.detalle && (
                <div className="border-t pt-3">
                  <div className="text-xs text-muted-foreground mb-1">Detalle / Concepto</div>
                  <div className="rounded bg-muted/30 px-3 py-2 text-sm">{detalleDoc.detalle}</div>
                </div>
              )}
              <div className="border-t pt-3 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDetalleDoc(null)}>
                  Cerrar
                </Button>
                <Button
                  className="gap-1"
                  onClick={() => printDocCxc(detalleDoc.tipo_doc, detalleDoc.no_doc, noCia, punto || '01')}
                >
                  <Printer className="h-4 w-4" />
                  Imprimir documento
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Balance de Clientes (Envejecimiento) ────────────────────────────────────
export function CxcBalance({ noCia, punto }: P) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const r = await regalGeneralApi.cxcBalanceClientes(noCia, punto); setRows(r) }
    finally { setLoading(false) }
  }

  const total = (key: string) => rows.reduce((s, r) => s + (r[key] || 0), 0)

  const exportCsv = () => {
    const headers = ['Cliente','Nombre','Total','0-30','31-60','61-90','+90']
    const data = rows.map(r => [r.no_cliente, r.nombre_cliente, r.total_saldo, r.dias_0_30, r.dias_31_60, r.dias_61_90, r.mas_90])
    const csv = [headers, ...data].map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'balance_clientes.csv'
    a.click()
  }

  const printPdf = () => {
    const qs = new URLSearchParams({ no_cia: noCia ?? '' })
    if (punto) qs.set('punto', punto)
    window.open(`/print/cxc-balance-clientes/current?${qs.toString()}`, '_blank')
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Balance de Clientes — Envejecimiento de Cartera</h1>
        <div className="flex gap-2">
          <Button onClick={exportCsv} variant="outline" size="sm" disabled={!rows.length}><FileDown className="h-4 w-4 mr-1" />CSV</Button>
          <Button onClick={printPdf} variant="outline" size="sm" disabled={!rows.length}><Printer className="h-4 w-4 mr-1" />PDF</Button>
          <Button onClick={load} size="sm" className="gap-1"><Search className="h-4 w-4" />Actualizar</Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Cliente</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right bg-green-50">0–30 días</TableHead>
              <TableHead className="text-right bg-yellow-50">31–60 días</TableHead>
              <TableHead className="text-right bg-orange-50">61–90 días</TableHead>
              <TableHead className="text-right bg-red-50">+90 días</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={8} className="text-center py-8">Cargando...</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Presione Actualizar</TableCell></TableRow>}
            {rows.map(r => (
              <TableRow key={r.no_cliente}>
                <TableCell className="font-mono text-sm">{r.no_cliente}</TableCell>
                <TableCell className="font-medium">{r.nombre_cliente}</TableCell>
                <TableCell>{r.vendedor}</TableCell>
                <TableCell className="text-right font-semibold">{fmt(r.total_saldo)}</TableCell>
                <TableCell className="text-right text-green-700 bg-green-50/50">{fmt(r.dias_0_30)}</TableCell>
                <TableCell className="text-right text-yellow-700 bg-yellow-50/50">{fmt(r.dias_31_60)}</TableCell>
                <TableCell className="text-right text-orange-700 bg-orange-50/50">{fmt(r.dias_61_90)}</TableCell>
                <TableCell className="text-right text-red-700 bg-red-50/50">{fmt(r.mas_90)}</TableCell>
              </TableRow>
            ))}
            {rows.length > 0 && (
              <TableRow className="font-bold bg-muted/50 border-t-2">
                <TableCell colSpan={3}>TOTALES</TableCell>
                <TableCell className="text-right">{fmt(total('total_saldo'))}</TableCell>
                <TableCell className="text-right text-green-700">{fmt(total('dias_0_30'))}</TableCell>
                <TableCell className="text-right text-yellow-700">{fmt(total('dias_31_60'))}</TableCell>
                <TableCell className="text-right text-orange-700">{fmt(total('dias_61_90'))}</TableCell>
                <TableCell className="text-right text-red-700">{fmt(total('mas_90'))}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ─── Histórico de Pagos ───────────────────────────────────────────────────────
export function CxcHistorico({ noCia }: P) {
  const [noCliente, setNoCliente] = useState('')
  const [desde, setDesde] = useState(firstOfMonth)
  const [hasta, setHasta] = useState(today)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const r = await regalGeneralApi.cxcHistorico(noCia, noCliente, desde, hasta); setRows(r) }
    finally { setLoading(false) }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Histórico de Pagos</h1>
      <div className="flex flex-wrap gap-3 border rounded-lg p-3 bg-muted/30">
        <div className="space-y-1"><Label className="text-xs">No. Cliente</Label><Input value={noCliente} onChange={e => setNoCliente(e.target.value)} className="h-8 w-28 font-mono" /></div>
        <div className="space-y-1"><Label className="text-xs">Desde</Label><Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="h-8 w-36" /></div>
        <div className="space-y-1"><Label className="text-xs">Hasta</Label><Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="h-8 w-36" /></div>
        <div className="flex items-end"><Button onClick={load} size="sm" className="h-8 gap-1"><Search className="h-4 w-4" />Consultar</Button></div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Documento</TableHead>
              <TableHead className="w-20">Tipo</TableHead>
              <TableHead className="w-28">Fecha</TableHead>
              <TableHead className="w-24">Cliente</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-32 text-right">Valor</TableHead>
              <TableHead className="w-32 text-right">Saldo</TableHead>
              <TableHead className="w-20">Mov.</TableHead>
              <TableHead className="w-24">NCF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={9} className="text-center py-8">Cargando...</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sin registros</TableCell></TableRow>}
            {rows.map(r => (
              <TableRow key={r.no_doc}>
                <TableCell className="font-mono text-sm">{r.no_doc}</TableCell>
                <TableCell><Badge variant="outline">{r.tipo_doc}</Badge></TableCell>
                <TableCell>{r.fecha}</TableCell>
                <TableCell className="font-mono">{r.no_cliente}</TableCell>
                <TableCell className="truncate max-w-[160px]">{r.nombre_cliente}</TableCell>
                <TableCell className="text-right">{fmt(r.valor)}</TableCell>
                <TableCell className={`text-right ${Number(r.saldo) > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(r.saldo)}</TableCell>
                <TableCell><Badge variant={r.tipo_movimiento === 'DR' ? 'default' : 'secondary'}>{r.tipo_movimiento}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{r.ncf}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ─── Libro de Ventas ──────────────────────────────────────────────────────────
export function CxcLibroVentas({ noCia, punto }: P) {
  const [desde, setDesde] = useState(firstOfMonth)
  const [hasta, setHasta] = useState(today)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const r = await regalGeneralApi.cxcLibroVentas(noCia, desde, hasta, punto); setRows(r) }
    finally { setLoading(false) }
  }

  const total = rows.reduce((s, r) => s + Number(r.valor || 0), 0)

  const exportCsv = () => {
    const headers = ['No Doc','Tipo','Fecha','NCF','Cliente','RNC','Valor']
    const data = rows.map(r => [r.no_doc, r.tipo_doc, r.fecha, r.ncf, r.nombre_cliente, r.rnc, r.valor])
    const csv = [headers, ...data].map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `libro_ventas_${desde}_${hasta}.csv`
    a.click()
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Libro de Ventas</h1>
        <Button onClick={exportCsv} variant="outline" size="sm" disabled={!rows.length}><FileDown className="h-4 w-4 mr-1" />CSV</Button>
      </div>
      <div className="flex gap-3 border rounded-lg p-3 bg-muted/30">
        <div className="space-y-1"><Label className="text-xs">Desde</Label><Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="h-8 w-36" /></div>
        <div className="space-y-1"><Label className="text-xs">Hasta</Label><Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="h-8 w-36" /></div>
        <div className="flex items-end"><Button onClick={load} size="sm" className="h-8 gap-1"><Search className="h-4 w-4" />Generar</Button></div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">No. Doc</TableHead>
              <TableHead className="w-20">Tipo</TableHead>
              <TableHead className="w-28">Fecha</TableHead>
              <TableHead className="w-24 font-mono">NCF</TableHead>
              <TableHead className="w-24">Cliente</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-28">RNC</TableHead>
              <TableHead className="w-32 text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={8} className="text-center py-8">Cargando...</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Sin registros</TableCell></TableRow>}
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-sm">{r.no_doc}</TableCell>
                <TableCell><Badge variant="outline">{r.tipo_doc}</Badge></TableCell>
                <TableCell>{r.fecha}</TableCell>
                <TableCell className="font-mono text-xs">{r.ncf}</TableCell>
                <TableCell className="font-mono">{r.no_cliente}</TableCell>
                <TableCell className="truncate max-w-[160px]">{r.nombre_cliente}</TableCell>
                <TableCell>{r.rnc}</TableCell>
                <TableCell className="text-right">{fmt(r.valor)}</TableCell>
              </TableRow>
            ))}
            {rows.length > 0 && (
              <TableRow className="font-bold bg-muted/50">
                <TableCell colSpan={7}>TOTAL ({rows.length} documentos)</TableCell>
                <TableCell className="text-right">{fmt(total)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
