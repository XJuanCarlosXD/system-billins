// ACC — Proceso de Reposición de Caja Chica (Facc204).
// Selecciona caja → trae documentos pendientes → captura cheque/efectivo/NCF
// → POST /api/acc/reposiciones/crear/ → abre PDF.
import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Save, FileText, Search } from 'lucide-react'

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (s: any) => s ? String(s).slice(0, 10) : ''
const today = () => new Date().toISOString().slice(0, 10)

interface CajaChica {
  no_caja: string; descripcion: string; cuenta: string; moneda: string
  monto: number; activa: string
}

interface DocPendiente {
  no_docu: string; fecha: string; no_bene: string; nombre_bene: string
  tipo_gasto: string; desc_gasto: string; valor: number; impuesto: number
  ncf: string; rnc: string; detalle: string; no_caja: string
}

export function AccReposicion() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()

  const [noCaja, setNoCaja] = useState('')
  const [fecha, setFecha] = useState(today())
  const [tipoDocuChc, setTipoDocuChc] = useState('CK')
  const [noDocuChc, setNoDocuChc] = useState('')
  const [cuentaBanco, setCuentaBanco] = useState('')
  const [noCheque, setNoCheque] = useState('')
  const [detalle, setDetalle] = useState('')
  const [efectivo, setEfectivo] = useState('0')
  const [valorComproProv, setValorComproProv] = useState('0')
  const [ncf, setNcf] = useState('')
  const [valorNcf, setValorNcf] = useState('0')
  const [posicionesNcf, setPosicionesNcf] = useState('')
  const [formaPago, setFormaPago] = useState('1')
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())

  const cajasQ = useQuery({
    queryKey: ['acc-cajas', selectedCompany, selectedPoint],
    queryFn: () => api.accListCajas(selectedCompany, selectedPoint),
    enabled: !!selectedCompany,
  })
  const cajas: CajaChica[] = (cajasQ.data || []).filter((c: any) => c.activa === 'S' || c.activa === 'A')
  const cajaSel = cajas.find((c) => c.no_caja === noCaja)

  const docsQ = useQuery({
    queryKey: ['acc-docs-pend', selectedCompany, selectedPoint, noCaja],
    queryFn: () => api.accDocsPendientesReposicion({
      no_cia: selectedCompany, punto: selectedPoint, no_caja: noCaja || undefined,
    }),
    enabled: !!selectedCompany && !!noCaja,
  })
  const docs: DocPendiente[] = docsQ.data || []

  const seleccionados = useMemo(
    () => docs.filter((d) => seleccion.has(d.no_docu)),
    [docs, seleccion],
  )
  const totalSel = useMemo(
    () => seleccionados.reduce((a, d) => a + Number(d.valor || 0), 0),
    [seleccionados],
  )
  const impuestoSel = useMemo(
    () => seleccionados.reduce((a, d) => a + Number(d.impuesto || 0), 0),
    [seleccionados],
  )

  const todosSel = docs.length > 0 && docs.every((d) => seleccion.has(d.no_docu))
  const algunosSel = !todosSel && docs.some((d) => seleccion.has(d.no_docu))

  const toggleTodos = () => {
    if (todosSel) setSeleccion(new Set())
    else setSeleccion(new Set(docs.map((d) => d.no_docu)))
  }
  const toggleUno = (no: string) => {
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(no)) next.delete(no); else next.add(no)
      return next
    })
  }

  const crear = useMutation({
    mutationFn: () => api.accCrearReposicion({
      no_cia: selectedCompany,
      punto: selectedPoint,
      no_caja: noCaja,
      fecha,
      tipo_docu_chc: tipoDocuChc,
      no_docu_chc: noDocuChc || undefined,
      cuenta_banco: cuentaBanco || undefined,
      no_cheque: noCheque || undefined,
      detalle: detalle || undefined,
      monto_cc: Number(cajaSel?.monto || 0),
      valor_reposicion: totalSel,
      efectivo: Number(efectivo) || 0,
      valor_compro_prov: Number(valorComproProv) || 0,
      ncf: ncf || undefined,
      valor_ncf: Number(valorNcf) || 0,
      posiciones_fijas_ncf: posicionesNcf || undefined,
      forma_pago: Number(formaPago) || 1,
      docs: seleccionados.map((d) => d.no_docu),
    }),
    onSuccess: (res) => {
      toast.success(`Reposición REP-${res.no_reposicion} creada (${seleccionados.length} docs · RD$ ${fmt(totalSel)})`)
      qc.invalidateQueries({ queryKey: ['acc-docs-pend'] })
      qc.invalidateQueries({ queryKey: ['acc-reposiciones'] })
      // Abre PDF automáticamente
      const qs = new URLSearchParams({ no_cia: selectedCompany, punto: selectedPoint }).toString()
      window.open(`/print/acc-reposicion/${encodeURIComponent(res.no_reposicion)}?${qs}`, '_blank', 'noopener')
      // Reset
      setSeleccion(new Set()); setNoDocuChc(''); setNoCheque(''); setDetalle('')
      setEfectivo('0'); setValorComproProv('0'); setNcf(''); setValorNcf('0')
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo crear la reposición'),
  })

  const puedeGuardar = !!noCaja && seleccionados.length > 0 && totalSel > 0 && !crear.isPending

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Reposición de Caja Chica</h3>
        <p className="text-sm text-muted-foreground">
          Equivale a <i>Facc204 — Reposición</i>. Selecciona los egresos pendientes
          que quieres reponer y captura los datos del cheque/efectivo de reposición.
          Persiste en <code>TACC_REPOSICION</code> y vincula <code>TACC_DOCUMENTO.no_reposicion</code>.
        </p>
      </div>

      {/* Selección de caja + estado */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card><CardContent className="py-3">
          <Label className="text-xs">Caja Chica</Label>
          <Select value={noCaja} onValueChange={(v) => { setNoCaja(v); setSeleccion(new Set()) }}>
            <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecciona caja…" /></SelectTrigger>
            <SelectContent>
              {cajas.map((c) => (
                <SelectItem key={c.no_caja} value={c.no_caja}>
                  {c.no_caja} — {c.descripcion}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent></Card>
        {cajaSel && (
          <>
            <Card><CardContent className="py-3">
              <div className="text-xs text-muted-foreground">Monto autorizado</div>
              <div className="text-xl font-semibold tabular-nums">RD$ {fmt(cajaSel.monto)}</div>
            </CardContent></Card>
            <Card><CardContent className="py-3">
              <div className="text-xs text-muted-foreground">Egresos pendientes</div>
              <div className="text-2xl font-semibold">{docs.length}</div>
            </CardContent></Card>
            <Card><CardContent className="py-3">
              <div className="text-xs text-muted-foreground">Seleccionados · monto</div>
              <div className="text-xl font-semibold tabular-nums">
                {seleccionados.length} · RD$ {fmt(totalSel)}
              </div>
            </CardContent></Card>
          </>
        )}
      </div>

      {/* Tabla de egresos pendientes */}
      {noCaja && (
        <div className="rounded border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={todosSel ? true : algunosSel ? 'indeterminate' : false}
                    onCheckedChange={toggleTodos} />
                </TableHead>
                <TableHead>No. Documento</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Beneficiario</TableHead>
                <TableHead>Tipo gasto</TableHead>
                <TableHead>NCF</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">ITBIS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docsQ.isLoading ? (
                <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                  Cargando…
                </TableCell></TableRow>
              ) : docs.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                  No hay egresos pendientes de reposición para esta caja.
                </TableCell></TableRow>
              ) : (
                docs.map((d) => (
                  <TableRow key={d.no_docu}
                    className={seleccion.has(d.no_docu) ? 'bg-emerald-50/60' : ''}>
                    <TableCell><Checkbox checked={seleccion.has(d.no_docu)}
                      onCheckedChange={() => toggleUno(d.no_docu)} /></TableCell>
                    <TableCell className="font-mono text-xs">ACC-{d.no_docu}</TableCell>
                    <TableCell>{fmtDate(d.fecha)}</TableCell>
                    <TableCell className="truncate max-w-xs">
                      <span className="font-mono text-xs text-muted-foreground">{d.no_bene}</span>{' '}
                      {d.nombre_bene}
                    </TableCell>
                    <TableCell className="text-xs">{d.tipo_gasto} {d.desc_gasto}</TableCell>
                    <TableCell className="font-mono text-xs">{d.ncf || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">RD$ {fmt(d.valor)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(d.impuesto)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Captura cheque + NCF + totales */}
      {noCaja && seleccionados.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Datos de la reposición</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Fecha <span className="text-destructive">*</span></Label>
                <Input type="date" className="h-9" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Tipo doc CHC</Label>
                <Select value={tipoDocuChc} onValueChange={setTipoDocuChc}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CK">Cheque (CK)</SelectItem>
                    <SelectItem value="SO">Solicitud (SO)</SelectItem>
                    <SelectItem value="CG">Comprobante Gasto (CG)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">No. doc CHC</Label>
                <Input className="h-9 font-mono" value={noDocuChc} onChange={(e) => setNoDocuChc(e.target.value)}
                  placeholder="opc." />
              </div>
              <div>
                <Label className="text-xs">Forma de pago</Label>
                <Select value={formaPago} onValueChange={setFormaPago}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Efectivo</SelectItem>
                    <SelectItem value="2">Cheque</SelectItem>
                    <SelectItem value="3">Transferencia</SelectItem>
                    <SelectItem value="4">Tarjeta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Cuenta banco</Label>
                <Input className="h-9 font-mono" value={cuentaBanco} onChange={(e) => setCuentaBanco(e.target.value)}
                  placeholder="opc." />
              </div>
              <div>
                <Label className="text-xs">No. cheque</Label>
                <Input className="h-9 font-mono" value={noCheque} onChange={(e) => setNoCheque(e.target.value)}
                  placeholder="opc." />
              </div>
              <div>
                <Label className="text-xs">NCF (proveedor)</Label>
                <Input className="h-9 font-mono" value={ncf} onChange={(e) => setNcf(e.target.value)}
                  placeholder="B01..." />
              </div>
              <div>
                <Label className="text-xs">Valor NCF</Label>
                <Input type="number" min={0} step="0.01" className="h-9 text-right tabular-nums"
                  value={valorNcf} onChange={(e) => setValorNcf(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Efectivo</Label>
                <Input type="number" min={0} step="0.01" className="h-9 text-right tabular-nums"
                  value={efectivo} onChange={(e) => setEfectivo(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Comprob. proveedor</Label>
                <Input type="number" min={0} step="0.01" className="h-9 text-right tabular-nums"
                  value={valorComproProv} onChange={(e) => setValorComproProv(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Posiciones NCF (opc.)</Label>
                <Input className="h-9 font-mono" value={posicionesNcf} onChange={(e) => setPosicionesNcf(e.target.value)}
                  placeholder="E31..." />
              </div>
            </div>
            <div>
              <Label className="text-xs">Detalle / observaciones</Label>
              <Textarea className="min-h-[60px]" value={detalle} onChange={(e) => setDetalle(e.target.value)}
                placeholder="Información de la reposición…" />
            </div>
            <div className="flex items-end justify-between border-t pt-3">
              <div className="space-y-1 text-sm">
                <div>
                  Egresos: <Badge variant="secondary">{seleccionados.length}</Badge>
                </div>
                <div className="text-muted-foreground text-xs">
                  ITBIS incluido: RD$ {fmt(impuestoSel)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Total a reponer</div>
                <div className="text-2xl font-semibold tabular-nums">RD$ {fmt(totalSel)}</div>
              </div>
              <Button onClick={() => crear.mutate()} disabled={!puedeGuardar}>
                <Save className="h-4 w-4 mr-1" />
                {crear.isPending ? 'Guardando…' : 'Guardar e imprimir'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!noCaja && (
        <div className="rounded border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          <Search className="h-5 w-5 mx-auto mb-2" />
          Selecciona una caja para ver sus egresos pendientes de reposición.
        </div>
      )}

      <div className="text-xs text-muted-foreground flex items-center gap-2 pt-1">
        <FileText className="h-3 w-3" /> Al guardar se abre automáticamente el PDF de la reposición.
      </div>
    </div>
  )
}
