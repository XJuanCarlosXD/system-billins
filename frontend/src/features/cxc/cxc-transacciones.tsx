// FCXC201 — Entrada de Transacciones CXC (DR/CR contra clientes)
// Reescrito 2026-06-11: noCia/punto vienen de useCompany (no se muestran al usuario),
// React Query para tdocus/punto/clientes, comboboxes contables, validación de período,
// botón Imprimir tras guardar.
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, Save, Printer, Search, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { CuentaCombobox } from '@/components/cnt/cuenta-combobox'
import { CentroCostoCombobox } from '@/components/cnt/centro-costo-combobox'

interface P { noCia: string; punto?: string }

interface Linea {
  cuenta: string
  cuenta_nombre?: string
  centro_costo: string
  centro_costo_nombre?: string
  debito: number
  credito: number
  detalle: string
}

const BLANK_LINEA: Linea = {
  cuenta: '', cuenta_nombre: '', centro_costo: '', centro_costo_nombre: '',
  debito: 0, credito: 0, detalle: '',
}

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function fmtMoney(n: number) {
  return Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function CxcTransacciones({ noCia, punto = '01' }: P) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)

  // ── Datos del módulo ──────────────────────────────────────────────
  const tdocusQ = useQuery({
    queryKey: ['cxc-tdocu', noCia],
    queryFn: () => regalGeneralApi.cxcListTdocu(noCia),
    enabled: !!noCia,
    staleTime: 5 * 60 * 1000,
  })

  const puntoQ = useQuery({
    queryKey: ['cxc-punto', noCia, punto],
    queryFn: async () => {
      const all = await regalGeneralApi.cxcListPuntos(noCia)
      return (all as any[]).find(p => String(p.punto) === String(punto)) || null
    },
    enabled: !!noCia,
  })

  const nextDocQ = useQuery({
    queryKey: ['cxc-next-doc', noCia, punto],
    queryFn: () => regalGeneralApi.cxcGetNextDoc(noCia, punto),
    enabled: !!noCia,
  })

  // ── Estado del formulario ─────────────────────────────────────────
  const [tipoDoc, setTipoDoc] = useState('')
  const [fecha, setFecha] = useState(today)
  const [cliente, setCliente] = useState<{ no_cliente: string; nombre_cliente: string; rnc?: string } | null>(null)
  const [clienteQ, setClienteQ] = useState('')
  const [ncf, setNcf] = useState('')
  const [ncfAnterior, setNcfAnterior] = useState('')
  const [detalleGeneral, setDetalleGeneral] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([{ ...BLANK_LINEA }])
  const [ultimoNoDoc, setUltimoNoDoc] = useState<string | null>(null)

  const tdocusActivos = useMemo(() => (tdocusQ.data ?? []).filter((t: any) => t.activo === 'S'), [tdocusQ.data])
  const tipoDocSel = useMemo(() => tdocusActivos.find((t: any) => t.tipo_doc === tipoDoc), [tdocusActivos, tipoDoc])
  const tipoMovimiento = tipoDocSel?.tipo_movimiento || ''
  const requiereNcf = !!tipoDocSel?.codigo_ncf

  // Búsqueda de clientes con debounce simple (se dispara con Enter o botón)
  const [clienteResults, setClienteResults] = useState<any[]>([])
  const buscarCliente = async () => {
    if (!clienteQ.trim()) return
    const res: any = await regalGeneralApi.cxcListClientes(noCia, clienteQ, 1)
    setClienteResults(res.items || [])
  }
  const seleccionarCliente = (c: any) => {
    setCliente({ no_cliente: c.no_cliente, nombre_cliente: c.nombre_cliente, rnc: c.rnc })
    setClienteResults([])
    setClienteQ('')
  }

  // ── Cálculos del asiento ──────────────────────────────────────────
  const totalDebito = lineas.reduce((s, l) => s + Number(l.debito || 0), 0)
  const totalCredito = lineas.reduce((s, l) => s + Number(l.credito || 0), 0)
  const diferencia = Math.abs(totalDebito - totalCredito)
  const balanced = diferencia < 0.001 && (totalDebito + totalCredito) > 0
  const valorDoc = Math.max(totalDebito, totalCredito)

  // ── Período abierto: validación de fecha contra TCXC_PUNTO.mes_proceso/ano_proceso ─
  const periodoMesAno = puntoQ.data ? `${MESES_ES[(puntoQ.data.mes_proceso || 1) - 1]} ${puntoQ.data.ano_proceso}` : ''
  const fechaFueraDePeriodo = useMemo(() => {
    if (!puntoQ.data || !fecha) return false
    const [y, m] = fecha.split('-').map(Number)
    return y !== puntoQ.data.ano_proceso || m !== puntoQ.data.mes_proceso
  }, [fecha, puntoQ.data])

  // ── Mutación grabar ───────────────────────────────────────────────
  const grabarMut = useMutation({
    mutationFn: async () => {
      const payload = {
        no_cia: noCia, punto,
        tipo_doc: tipoDoc, no_doc: nextDocQ.data?.no_doc || '',
        no_cliente: cliente!.no_cliente, nombre_cliente: cliente!.nombre_cliente,
        fecha, valor: valorDoc,
        detalle: detalleGeneral, ncf, ncf_anterior: ncfAnterior,
        tipo_movimiento: tipoMovimiento,
        lineas: lineas.map(l => ({
          cuenta: l.cuenta, centro_costo: l.centro_costo || '0000000000',
          debito: Number(l.debito || 0), credito: Number(l.credito || 0),
          detalle: l.detalle,
        })),
      }
      return regalGeneralApi.cxcSaveDocumento(payload as any)
    },
    onSuccess: (res: any) => {
      const noDoc = res?.no_doc || nextDocQ.data?.no_doc || ''
      setUltimoNoDoc(noDoc)
      toast.success(`Documento ${tipoDoc}-${noDoc} guardado correctamente`)
      // Limpiar y avanzar
      qc.invalidateQueries({ queryKey: ['cxc-next-doc', noCia, punto] })
      setCliente(null); setNcf(''); setNcfAnterior('')
      setDetalleGeneral(''); setLineas([{ ...BLANK_LINEA }])
      setFecha(today)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar'),
  })

  const validar = (): string | null => {
    if (!tipoDoc) return 'Seleccione el tipo de documento'
    if (!cliente) return 'Seleccione un cliente'
    if (fechaFueraDePeriodo) return `La fecha debe estar dentro del período activo: ${periodoMesAno}`
    if (lineas.length === 0) return 'Agregue al menos una línea contable'
    if (lineas.some(l => !l.cuenta)) return 'Todas las líneas deben tener cuenta seleccionada'
    if ((totalDebito + totalCredito) === 0) return 'Los montos no pueden ser cero'
    if (!balanced) return `Asiento desbalanceado: Débitos RD$ ${fmtMoney(totalDebito)} ≠ Créditos RD$ ${fmtMoney(totalCredito)}`
    if (requiereNcf && !ncf.trim()) return `Este tipo de documento requiere NCF (${tipoDocSel?.codigo_ncf})`
    return null
  }

  const onGrabar = () => {
    const err = validar()
    if (err) { toast.error(err); return }
    grabarMut.mutate()
  }

  const setLinea = (i: number, k: keyof Linea, v: any) => {
    setLineas(prev => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l))
  }

  const setLineaCuenta = (i: number, cuenta: string, nombre?: string) => {
    setLineas(prev => prev.map((l, idx) => idx === i ? { ...l, cuenta, cuenta_nombre: nombre } : l))
  }

  const setLineaCentro = (i: number, centro: string, nombre?: string) => {
    setLineas(prev => prev.map((l, idx) => idx === i ? { ...l, centro_costo: centro, centro_costo_nombre: nombre } : l))
  }

  const imprimirUltimo = () => {
    if (!ultimoNoDoc) return
    const qs = new URLSearchParams({ no_cia: noCia, punto }).toString()
    window.open(`/print/recibo-cobro/${encodeURIComponent(ultimoNoDoc)}?${qs}`, '_blank', 'noopener')
  }

  const validacion = validar()

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      {/* Cabecera con contexto: empresa, período, número que se asignará */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Nueva Transacción CxC</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Asiento contable contra un cliente · Débitos = Créditos
              </p>
            </div>
            <div className="flex items-center gap-2">
              {puntoQ.data && (
                <Badge variant="outline" className="text-xs">
                  Período: <span className="font-semibold ml-1">{periodoMesAno}</span>
                </Badge>
              )}
              {nextDocQ.data && (
                <Badge variant="secondary" className="text-xs">
                  Próximo No:&nbsp;<span className="font-mono ml-1">{nextDocQ.data.no_doc}</span>
                </Badge>
              )}
              {ultimoNoDoc && (
                <Button size="sm" variant="outline" onClick={imprimirUltimo}>
                  <Printer className="h-3.5 w-3.5 mr-1" />
                  Imprimir {tipoDoc}-{ultimoNoDoc}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tipo documento + fecha + movimiento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de Documento *</Label>
              <Select value={tipoDoc} onValueChange={setTipoDoc}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Seleccione tipo…" />
                </SelectTrigger>
                <SelectContent>
                  {tdocusActivos.map((t: any) => (
                    <SelectItem key={t.tipo_doc} value={t.tipo_doc}>
                      <span className="font-mono mr-2">{t.tipo_doc}</span>
                      {t.descripcion}
                      <Badge variant={t.tipo_movimiento === 'DR' ? 'default' : 'secondary'} className="ml-2 text-[10px] px-1">
                        {t.tipo_movimiento}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tipoDocSel?.tipo_transaccion && (
                <p className="text-[11px] text-muted-foreground">
                  Transacción: {tipoDocSel.tipo_transaccion}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Fecha *</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="h-9" />
              {fechaFueraDePeriodo && (
                <p className="text-[11px] text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Fuera del período activo
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Movimiento</Label>
              <div className="flex items-center h-9">
                {tipoMovimiento
                  ? (
                    <Badge variant={tipoMovimiento === 'DR' ? 'default' : 'secondary'} className="h-7 px-3 text-sm">
                      {tipoMovimiento === 'DR' ? 'Débito (DR)' : 'Crédito (CR)'}
                    </Badge>
                  )
                  : <span className="text-xs text-muted-foreground">— Sin tipo seleccionado —</span>}
              </div>
            </div>
          </div>

          {/* Cliente */}
          <div className="space-y-1.5">
            <Label className="text-xs">Cliente *</Label>
            {cliente ? (
              <div className="flex items-center gap-2 p-2 bg-muted/40 border rounded">
                <Badge variant="outline" className="font-mono">{cliente.no_cliente}</Badge>
                <span className="text-sm font-medium flex-1">{cliente.nombre_cliente}</span>
                {cliente.rnc && <span className="text-xs text-muted-foreground">RNC: {cliente.rnc}</span>}
                <Button size="sm" variant="ghost" onClick={() => setCliente(null)}>Cambiar</Button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex gap-2">
                  <Input
                    value={clienteQ}
                    onChange={e => setClienteQ(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), buscarCliente())}
                    placeholder="Buscar por nombre, RNC o código…"
                    className="h-9"
                  />
                  <Button onClick={buscarCliente} variant="secondary" size="sm" className="h-9">
                    <Search className="h-4 w-4 mr-1" /> Buscar
                  </Button>
                </div>
                {clienteResults.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 border rounded-md shadow-lg bg-background max-h-60 overflow-y-auto">
                    {clienteResults.map((c: any) => (
                      <button
                        key={c.no_cliente}
                        onClick={() => seleccionarCliente(c)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-0 flex items-center gap-2"
                      >
                        <Badge variant="outline" className="font-mono text-xs">{c.no_cliente}</Badge>
                        <span className="flex-1">{c.nombre_cliente}</span>
                        {c.rnc && <span className="text-xs text-muted-foreground">{c.rnc}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* NCF (condicional) + Detalle */}
          {requiereNcf && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 border border-dashed rounded bg-amber-50/50">
              <div className="space-y-1.5">
                <Label className="text-xs">NCF * <span className="text-muted-foreground">({tipoDocSel?.codigo_ncf})</span></Label>
                <Input value={ncf} onChange={e => setNcf(e.target.value)} maxLength={19} className="font-mono h-9 uppercase" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">NCF Anterior</Label>
                <Input value={ncfAnterior} onChange={e => setNcfAnterior(e.target.value)} maxLength={19} className="font-mono h-9 uppercase" />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Concepto / Detalle</Label>
            <Input value={detalleGeneral} onChange={e => setDetalleGeneral(e.target.value)} className="h-9"
                   placeholder="Descripción de la transacción…" />
          </div>
        </CardContent>
      </Card>

      {/* Líneas contables */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Distribución Contable</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Asignar cuenta y centro de costo. La suma de débitos debe igualar la suma de créditos.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setLineas(l => [...l, { ...BLANK_LINEA }])}>
              <Plus className="h-4 w-4 mr-1" /> Agregar línea
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[280px]">Cuenta *</TableHead>
                  <TableHead className="w-[220px]">Centro Costo</TableHead>
                  <TableHead className="w-32 text-right">Débito</TableHead>
                  <TableHead className="w-32 text-right">Crédito</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineas.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <CuentaCombobox
                        value={l.cuenta}
                        onChange={(c, n) => setLineaCuenta(i, c, n)}
                        required
                      />
                    </TableCell>
                    <TableCell>
                      <CentroCostoCombobox
                        noCia={noCia}
                        value={l.centro_costo}
                        onChange={(c, n) => setLineaCentro(i, c, n)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number" step="0.01" value={l.debito || ''}
                        onChange={e => setLinea(i, 'debito', Number(e.target.value || 0))}
                        className="text-right h-8 tabular-nums font-mono"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number" step="0.01" value={l.credito || ''}
                        onChange={e => setLinea(i, 'credito', Number(e.target.value || 0))}
                        className="text-right h-8 tabular-nums font-mono"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={l.detalle}
                        onChange={e => setLinea(i, 'detalle', e.target.value)}
                        className="h-8"
                        placeholder="(opcional)"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                        onClick={() => setLineas(l2 => l2.filter((_, j) => j !== i))}
                        disabled={lineas.length === 1}
                        title="Eliminar línea"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                <TableRow className="bg-muted/60 font-semibold">
                  <TableCell colSpan={2} className="text-right">TOTALES</TableCell>
                  <TableCell className="text-right tabular-nums font-mono">RD$ {fmtMoney(totalDebito)}</TableCell>
                  <TableCell className="text-right tabular-nums font-mono">RD$ {fmtMoney(totalCredito)}</TableCell>
                  <TableCell colSpan={2}>
                    {balanced
                      ? <span className="text-green-700 text-xs flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Balanceado</span>
                      : (totalDebito + totalCredito) > 0
                        ? <span className="text-destructive text-xs flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> Diferencia RD$ {fmtMoney(diferencia)}</span>
                        : <span className="text-muted-foreground text-xs">Sin montos</span>}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Footer con valor, validación y acción */}
      <div className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-card sticky bottom-4">
        <div className="space-y-0.5">
          <div className="text-xs text-muted-foreground">Valor del documento</div>
          <div className="text-2xl font-bold tabular-nums font-mono">RD$ {fmtMoney(valorDoc)}</div>
        </div>
        {validacion && (
          <div className="flex-1 px-3 py-2 bg-destructive/10 border border-destructive/40 rounded text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {validacion}
          </div>
        )}
        <Button onClick={onGrabar} disabled={!!validacion || grabarMut.isPending} size="lg" className="gap-2 min-w-[180px]">
          <Save className="h-4 w-4" />
          {grabarMut.isPending ? 'Guardando…' : 'Grabar Documento'}
        </Button>
      </div>
    </div>
  )
}
