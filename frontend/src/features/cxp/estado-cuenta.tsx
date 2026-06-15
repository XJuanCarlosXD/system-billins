// CxP — Estado de Cuenta del proveedor.
// Espejo del flujo de CxC pero con proveedor. Cualquier saldo con
// documentos abiertos en TCXP_DOCUMENTO aparece aquí, agrupado por
// envejecimiento (0-30, 31-60, 61-90, +90).

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Search, FileDown, Printer, Loader2, FileText, Eye, X, UserCircle2,
} from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import '../cxc/print-estado-cuenta.css'

interface P { noCia: string; punto?: string }

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtInt = (n: any) => Number(n || 0).toLocaleString('es-DO')
const today = new Date().toISOString().slice(0, 10)
const fmtDate = (s: any) => s ? String(s).slice(0, 10) : ''

const docPrefijoTipo = (tipo: string) => (tipo || '').toString().trim().toUpperCase()
const docCode = (tipo: any, no: any) => {
  const t = docPrefijoTipo(tipo)
  const n = (no || '').toString().trim()
  return t ? `${t}-${n}` : n
}

// Mapeo tipo CxP → código de plantilla PDF.
const CXP_PRINT_CODE: Record<string, string> = {
  FP: 'cxp-factura-proveedor',
  AC: 'cxp-ajuste-credito',
  AD: 'cxp-ajuste-debito',
  BD: 'cxp-balance-debito',
  NC: 'cxp-nota-credito',
  ND: 'cxp-nota-debito',
  SO: 'cxp-solicitud-cheque',
}

const printDocCxp = (tipo: any, no: any, noCia: string, punto: string) => {
  const t = docPrefijoTipo(tipo)
  const code = CXP_PRINT_CODE[t]
  if (!code) {
    alert(`Imprimir no está disponible para el tipo ${t}`)
    return
  }
  const qs = new URLSearchParams({
    no_cia: noCia, punto: punto || '01',
  }).toString()
  window.open(
    `/print/${code}/${encodeURIComponent(t)}-${encodeURIComponent((no || '').toString().trim())}?${qs}`,
    '_blank', 'noopener',
  )
}

type Proveedor = {
  no_proveedor: string
  nombre?: string
  rnc?: string
  direccion?: string
  telefono?: string
}

export function CxpEstadoCuenta({ noCia, punto }: P) {
  const [proveedor, setProveedor] = useState<Proveedor | null>(null)
  const [busquedaOpen, setBusquedaOpen] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<any[]>([])
  const [buscando, setBuscando] = useState(false)

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [fechaCorte, setFechaCorte] = useState(today)
  const [detalleDoc, setDetalleDoc] = useState<any>(null)

  // Buscar proveedores (debounced)
  useEffect(() => {
    if (!busquedaOpen) return
    if (busqueda.length < 2) { setResultados([]); return }
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const res = await regalGeneralApi.cxpListProveedores({ search: busqueda, activo: 'S' })
        setResultados(Array.isArray(res) ? res.slice(0, 50) : [])
      } finally { setBuscando(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [busqueda, busquedaOpen])

  const load = async () => {
    if (!proveedor?.no_proveedor) return
    setLoading(true)
    try {
      const res = await regalGeneralApi.cxpEstadoCuenta(noCia, String(proveedor.no_proveedor), punto || '')
      setData(res)
    } catch {
      setData(null)
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (proveedor?.no_proveedor) load()
    else setData(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proveedor?.no_proveedor])

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
    if (!proveedor?.no_proveedor) return
    const qs = new URLSearchParams({ no_cia: noCia, punto: punto || '01', fecha_corte: fechaCorte }).toString()
    window.open(
      `/print/cxp-estado-cuenta/${encodeURIComponent(String(proveedor.no_proveedor))}?${qs}`,
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
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `estado_cuenta_cxp_${proveedor?.no_proveedor || ''}_${today}.csv`
    a.click()
  }

  const prov = data?.proveedor
  const aging = data?.aging || {}

  return (
    <div className="p-6 space-y-4 print:p-0">
      <div className="flex items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Estado de Cuenta — Proveedor</h1>
          <p className="text-sm text-muted-foreground">
            Saldos abiertos con el proveedor y envejecimiento de la deuda.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportCsv} disabled={!data?.documentos?.length} variant="outline" size="sm" className="gap-1">
            <FileDown className="h-4 w-4" /> CSV
          </Button>
          <Button onClick={handleImprimir} disabled={!data?.documentos?.length} variant="outline" size="sm" className="gap-1">
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border bg-muted/30 p-3 print:hidden">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Proveedor</Label>
            {proveedor ? (
              <div className="flex items-center gap-3 rounded-md border border-green-300 bg-green-50 p-2 dark:bg-green-950/30 dark:border-green-900">
                <UserCircle2 className="h-5 w-5 text-green-700" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-mono text-sm font-semibold text-green-900">{proveedor.no_proveedor}</span>
                    <span className="text-sm font-medium text-green-900 truncate">{proveedor.nombre}</span>
                    {proveedor.rnc && <span className="text-xs text-green-700">RNC: <span className="font-mono">{proveedor.rnc}</span></span>}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setProveedor(null)} className="h-7 w-7 p-0">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setBusquedaOpen(true)} className="w-full justify-start gap-2 h-10">
                <Search className="h-4 w-4 text-muted-foreground" />
                Seleccionar proveedor…
              </Button>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fecha de corte</Label>
            <Input type="date" value={fechaCorte} onChange={(e) => setFechaCorte(e.target.value)} className="h-9 w-40" />
          </div>
          <Button onClick={load} disabled={!proveedor || loading} size="sm" className="h-9 gap-1">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Actualizar
          </Button>
        </div>
      </div>

      {!data && !loading && (
        <div className="rounded-md border-2 border-dashed p-12 text-center text-muted-foreground print:hidden">
          <FileText className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Seleccione un proveedor para ver su estado de cuenta.</p>
        </div>
      )}

      {data && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">{prov?.no_proveedor}</span>
                {prov?.nombre}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {prov?.rnc && (
                  <div>
                    <div className="text-xs text-muted-foreground">RNC / Cédula</div>
                    <div className="font-mono">{prov.rnc}</div>
                  </div>
                )}
                {prov?.direccion && (
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground">Dirección</div>
                    <div className="truncate" title={prov.direccion}>{prov.direccion}</div>
                  </div>
                )}
                {prov?.telefono && (
                  <div>
                    <div className="text-xs text-muted-foreground">Teléfono</div>
                    <div className="font-mono">{prov.telefono}</div>
                  </div>
                )}
                {prov?.encargado && (
                  <div>
                    <div className="text-xs text-muted-foreground">Encargado</div>
                    <div>{prov.encargado}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-muted-foreground">Plazo</div>
                  <div>{fmtInt(prov?.dias)} días</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900">
              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium">Total a pagar</CardTitle></CardHeader>
              <CardContent>
                <div className="text-xl font-bold tabular-nums text-blue-900 dark:text-blue-200">RD$ {fmt(data.total_pendiente)}</div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900">
              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium">Al día (0–30)</CardTitle></CardHeader>
              <CardContent>
                <div className="text-lg font-semibold text-emerald-700 tabular-nums">RD$ {fmt(aging.d_0_30)}</div>
              </CardContent>
            </Card>
            <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-900">
              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium">31–60 días</CardTitle></CardHeader>
              <CardContent>
                <div className="text-lg font-semibold text-yellow-700 tabular-nums">RD$ {fmt(aging.d_31_60)}</div>
              </CardContent>
            </Card>
            <Card className="bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900">
              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium">61–90 días</CardTitle></CardHeader>
              <CardContent>
                <div className="text-lg font-semibold text-orange-700 tabular-nums">RD$ {fmt(aging.d_61_90)}</div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900">
              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium">+90 días (vencido)</CardTitle></CardHeader>
              <CardContent>
                <div className="text-lg font-semibold text-red-700 tabular-nums">RD$ {fmt(aging.d_mas_90)}</div>
              </CardContent>
            </Card>
          </div>

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
                  <TableRow><TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Cargando…
                  </TableCell></TableRow>
                )}
                {!loading && (data.documentos || []).length === 0 && (
                  <TableRow><TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                    Sin documentos pendientes
                  </TableCell></TableRow>
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
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDetalleDoc(d)} title="Ver detalle">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => printDocCxp(d.tipo_doc, d.no_doc, noCia, punto || '01')} title="Imprimir documento">
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

      {/* Modal buscar proveedor */}
      <Dialog open={busquedaOpen} onOpenChange={setBusquedaOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Buscar proveedor</DialogTitle>
            <DialogDescription>Busca por código, nombre o RNC.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Mínimo 2 caracteres…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="h-9 pl-8"
              />
            </div>
            <div className="border rounded max-h-80 overflow-y-auto">
              {buscando && (
                <div className="p-4 text-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                </div>
              )}
              {!buscando && resultados.length === 0 && busqueda.length >= 2 && (
                <div className="p-4 text-center text-sm text-muted-foreground">Sin resultados</div>
              )}
              {!buscando && resultados.map((p) => (
                <button
                  key={p.no_proveedor}
                  onClick={() => {
                    setProveedor({
                      no_proveedor: String(p.no_proveedor).trim(),
                      nombre: p.nombre, rnc: p.rnc,
                      direccion: p.direccion, telefono: p.telefono,
                    })
                    setBusquedaOpen(false)
                    setBusqueda('')
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-0 flex items-baseline gap-3"
                >
                  <span className="font-mono text-xs font-semibold">{p.no_proveedor}</span>
                  <span className="flex-1 truncate">{p.nombre}</span>
                  {p.rnc && <span className="text-xs text-muted-foreground font-mono">{p.rnc}</span>}
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal detalle de documento */}
      <Dialog open={!!detalleDoc} onOpenChange={(o) => !o && setDetalleDoc(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documento {docCode(detalleDoc?.tipo_doc, detalleDoc?.no_doc)}
            </DialogTitle>
            <DialogDescription>
              {detalleDoc?.tipo_label || detalleDoc?.tipo_doc} — {prov?.nombre}
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
                <Button variant="outline" onClick={() => setDetalleDoc(null)}>Cerrar</Button>
                <Button className="gap-1" onClick={() => printDocCxp(detalleDoc.tipo_doc, detalleDoc.no_doc, noCia, punto || '01')}>
                  <Printer className="h-4 w-4" />Imprimir documento
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
