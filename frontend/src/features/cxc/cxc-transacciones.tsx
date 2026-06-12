// Recibo de Cobro CxC — flujo legado FCXC201:
//   1. Selecciona el cliente
//   2. Aparecen sus facturas pendientes (TCXC_DOCUMENTO con saldo > 0)
//   3. El usuario marca cuáles afectar e indica el monto a aplicar
//   4. Al grabar: se inserta TCXC_DOCUMENTO (CR) + TCXC_REFEDOCU (aplicaciones)
//      + se reduce el saldo de cada factura referenciada.
//
// Refactor 2026-06-12 según skill sigaft-ui-facturacion: no_cia/punto desde useCompany,
// React Query, ClientePicker estilo FAT, CuentaCombobox para caja/banco.
import { useMemo, useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Save, Printer, AlertCircle, CheckCircle2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
import { ClientePicker } from '@/components/cxc/cliente-picker'

interface P { noCia: string; punto?: string }

type FacturaPendiente = {
  punto: string
  tipo_doc: string
  no_doc: string
  no_doc_display: string
  fecha: string | null
  detalle: string
  valor_original: number
  saldo: number
  ncf_dgi: string
}

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})

const fmtDate = (s: any) => {
  if (!s) return ''
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s).slice(0, 10)
}

export function CxcTransacciones({ noCia, punto = '01' }: P) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)

  // ── Datos ──────────────────────────────────────────────────────────
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
  const [cliente, setCliente] = useState<any | null>(null)
  const [ncf, setNcf] = useState('')
  const [detalle, setDetalle] = useState('')
  const [cuentaCaja, setCuentaCaja] = useState('')
  const [centroCosto, setCentroCosto] = useState('')
  /** key: 'tipo_doc-no_doc' → monto a aplicar */
  const [aplicaciones, setAplicaciones] = useState<Record<string, number>>({})
  const [ultimoNoDoc, setUltimoNoDoc] = useState<string | null>(null)

  const tdocusActivos = useMemo(() => (tdocusQ.data ?? []).filter((t: any) => t.activo === 'S'), [tdocusQ.data])

  // Para recibos solo mostramos tipos CR (crédito) — los DR son facturas/notas débito de FAT
  const tdocusCR = useMemo(
    () => tdocusActivos.filter((t: any) => (t.tipo_movimiento || t.tipo_movi || '').toUpperCase() === 'CR' || (t.tipo_movimiento || t.tipo_movi || '').toUpperCase() === 'C'),
    [tdocusActivos],
  )
  const tipoDocSel = useMemo(() => tdocusActivos.find((t: any) => t.tipo_doc === tipoDoc), [tdocusActivos, tipoDoc])
  const requiereNcf = !!tipoDocSel?.codigo_ncf

  // ── Facturas pendientes del cliente seleccionado ─────────────────
  const pendientesQ = useQuery({
    queryKey: ['cxc-pendientes', noCia, cliente?.no_cliente, punto],
    queryFn: () => regalGeneralApi.cxcFacturasPendientesCliente(noCia, String(cliente!.no_cliente), punto),
    enabled: !!cliente,
  })
  const pendientes: FacturaPendiente[] = (pendientesQ.data as any[]) ?? []

  // Al cambiar cliente, limpiar aplicaciones previas
  useEffect(() => {
    setAplicaciones({})
  }, [cliente?.no_cliente])

  // ── Cálculos ──────────────────────────────────────────────────────
  const totalAplicado = useMemo(
    () => Object.values(aplicaciones).reduce((s, n) => s + (Number(n) || 0), 0),
    [aplicaciones],
  )

  const periodoMesAno = puntoQ.data
    ? `${MESES_ES[(puntoQ.data.mes_proceso || 1) - 1]} ${puntoQ.data.ano_proceso}`
    : ''
  const fechaFueraDePeriodo = useMemo(() => {
    if (!puntoQ.data || !fecha) return false
    const [y, m] = fecha.split('-').map(Number)
    return y !== puntoQ.data.ano_proceso || m !== puntoQ.data.mes_proceso
  }, [fecha, puntoQ.data])

  // ── Mutación grabar ────────────────────────────────────────────────
  const grabarMut = useMutation({
    mutationFn: async () => {
      const aplicacionesArr = pendientes
        .map(p => {
          const key = `${p.tipo_doc}-${p.no_doc}`
          const monto = Number(aplicaciones[key] || 0)
          return monto > 0
            ? { tipo_ref: p.tipo_doc, no_ref: p.no_doc, monto }
            : null
        })
        .filter(Boolean) as Array<{ tipo_ref: string; no_ref: string; monto: number }>
      return regalGeneralApi.cxcCrearRecibo({
        no_cia: noCia, punto,
        tipo_doc: tipoDoc, no_cliente: String(cliente!.no_cliente),
        fecha, ncf, detalle,
        cuenta_default: cuentaCaja,
        centro_costo: centroCosto,
        aplicaciones: aplicacionesArr,
      })
    },
    onSuccess: (r: any) => {
      const noDoc = r?.no_doc || nextDocQ.data?.no_doc || ''
      setUltimoNoDoc(noDoc)
      toast.success(
        `Recibo ${tipoDoc}-${noDoc} grabado · ${r.aplicaciones_count} factura(s) afectada(s) · RD$ ${fmt(r.total)}`,
      )
      qc.invalidateQueries({ queryKey: ['cxc-next-doc', noCia, punto] })
      qc.invalidateQueries({ queryKey: ['cxc-pendientes', noCia, cliente?.no_cliente] })
      qc.invalidateQueries({ queryKey: ['cxc-documentos'] })
      // Reset
      setCliente(null)
      setNcf('')
      setDetalle('')
      setAplicaciones({})
      setFecha(today)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al grabar el recibo'),
  })

  // ── Validación ─────────────────────────────────────────────────────
  const validar = (): string | null => {
    if (!tipoDoc) return 'Seleccione el tipo de recibo'
    if (!cliente) return 'Seleccione un cliente'
    if (!cuentaCaja) return 'Seleccione la cuenta de caja/banco donde entra el dinero'
    if (fechaFueraDePeriodo) return `La fecha debe estar dentro del período activo: ${periodoMesAno}`
    if (totalAplicado <= 0) return 'Indique al menos un monto a aplicar a alguna factura'
    // Validar que ningún monto exceda el saldo de la factura
    for (const p of pendientes) {
      const key = `${p.tipo_doc}-${p.no_doc}`
      const m = Number(aplicaciones[key] || 0)
      if (m > p.saldo + 0.001) {
        return `Monto en ${p.no_doc_display} (RD$ ${fmt(m)}) excede su saldo (RD$ ${fmt(p.saldo)})`
      }
    }
    if (requiereNcf && !ncf.trim()) return `Este tipo de recibo requiere NCF (${tipoDocSel?.codigo_ncf})`
    return null
  }
  const validacion = validar()

  // Aplicar monto a factura específica
  const setMonto = (key: string, monto: number) => {
    setAplicaciones(prev => ({ ...prev, [key]: monto }))
  }

  // Marcar/desmarcar: si check → aplica saldo completo; si uncheck → 0
  const toggleFactura = (p: FacturaPendiente, check: boolean) => {
    const key = `${p.tipo_doc}-${p.no_doc}`
    setMonto(key, check ? p.saldo : 0)
  }

  const seleccionarTodo = () => {
    const next: Record<string, number> = {}
    for (const p of pendientes) next[`${p.tipo_doc}-${p.no_doc}`] = p.saldo
    setAplicaciones(next)
  }

  const limpiarTodo = () => setAplicaciones({})

  const imprimirUltimo = () => {
    if (!ultimoNoDoc) return
    const qs = new URLSearchParams({ no_cia: noCia, punto }).toString()
    window.open(`/print/recibo-cobro/${encodeURIComponent(ultimoNoDoc)}?${qs}`, '_blank', 'noopener')
  }

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      {/* Header / contexto */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Recibo de Cobro</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Aplica un pago del cliente a sus facturas pendientes. Equivale a la forma legada
                <i> Fcxc201 — Entrada de Documentos CR </i>
                (tablas TCXC_DOCUMENTO + TCXC_REFEDOCU).
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
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
          {/* Tipo recibo + fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de Recibo *</Label>
              <Select value={tipoDoc} onValueChange={setTipoDoc}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Seleccione tipo…" />
                </SelectTrigger>
                <SelectContent>
                  {tdocusCR.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      No hay tipos de documento crédito configurados para CxC.
                    </div>
                  )}
                  {tdocusCR.map((t: any) => (
                    <SelectItem key={t.tipo_doc} value={t.tipo_doc}>
                      <span className="font-mono mr-2">{t.tipo_doc}</span>
                      {t.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Sólo se muestran tipos crédito (CR) — los DR son facturas que vienen de FAT.
              </p>
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
              <Label className="text-xs">Cuenta de Caja / Banco *</Label>
              <CuentaCombobox value={cuentaCaja} onChange={setCuentaCaja} required />
              <p className="text-[11px] text-muted-foreground">Cuenta donde entra el dinero (débito).</p>
            </div>
          </div>

          {/* Cliente */}
          <div className="space-y-1.5">
            <Label className="text-xs">Cliente *</Label>
            <ClientePicker noCia={noCia} cliente={cliente} onChange={setCliente} />
          </div>

          {/* NCF (condicional) + Detalle + Centro de costo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {requiereNcf && (
              <div className="space-y-1.5">
                <Label className="text-xs">NCF * <span className="text-muted-foreground">({tipoDocSel?.codigo_ncf})</span></Label>
                <Input value={ncf} onChange={e => setNcf(e.target.value.toUpperCase())} maxLength={19} className="font-mono h-9 uppercase" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Centro de costo</Label>
              <CentroCostoCombobox noCia={noCia} value={centroCosto} onChange={setCentroCosto} />
            </div>
            <div className={`space-y-1.5 ${requiereNcf ? '' : 'sm:col-span-2'}`}>
              <Label className="text-xs">Concepto</Label>
              <Input
                value={detalle}
                onChange={e => setDetalle(e.target.value)}
                placeholder="Ej. Pago factura junio…"
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Facturas pendientes / aplicación */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base">Facturas pendientes del cliente</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Marque las facturas a las que se aplica el pago e indique el monto.
                El monto no puede exceder el saldo de la factura.
              </p>
            </div>
            {cliente && pendientes.length > 0 && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={seleccionarTodo}>
                  Aplicar a todas
                </Button>
                <Button size="sm" variant="ghost" onClick={limpiarTodo}>
                  Limpiar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!cliente && (
            <div className="text-center py-10 text-sm text-muted-foreground border rounded">
              Seleccione un cliente para ver sus facturas pendientes.
            </div>
          )}

          {cliente && pendientesQ.isLoading && (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Cargando facturas pendientes…
            </div>
          )}

          {cliente && !pendientesQ.isLoading && pendientes.length === 0 && (
            <div className="text-center py-10 text-sm border rounded bg-muted/30">
              <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-2" />
              El cliente <b>{cliente.nombre}</b> no tiene facturas pendientes en este momento.
            </div>
          )}

          {cliente && pendientes.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-12 text-center">Aplica</TableHead>
                    <TableHead className="w-32">Factura</TableHead>
                    <TableHead className="w-28">Fecha</TableHead>
                    <TableHead className="w-32">NCF</TableHead>
                    <TableHead>Concepto / Detalle</TableHead>
                    <TableHead className="w-32 text-right">Valor Orig.</TableHead>
                    <TableHead className="w-32 text-right">Saldo</TableHead>
                    <TableHead className="w-36 text-right">Monto a aplicar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendientes.map(p => {
                    const key = `${p.tipo_doc}-${p.no_doc}`
                    const monto = Number(aplicaciones[key] || 0)
                    const checked = monto > 0
                    const excedeSaldo = monto > p.saldo + 0.001
                    return (
                      <TableRow key={key} className={checked ? 'bg-green-50/40 dark:bg-green-950/10' : ''}>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v: any) => toggleFactura(p, !!v)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm font-semibold">
                          {p.no_doc_display}
                        </TableCell>
                        <TableCell className="tabular-nums text-sm">{fmtDate(p.fecha)}</TableCell>
                        <TableCell className="font-mono text-xs">{p.ncf_dgi || '—'}</TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                          {p.detalle || '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(p.valor_original)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-amber-700">
                          {fmt(p.saldo)}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max={p.saldo}
                            value={monto || ''}
                            onChange={e => setMonto(key, Number(e.target.value || 0))}
                            placeholder="0.00"
                            className={`h-8 text-right tabular-nums font-mono ${excedeSaldo ? 'border-destructive' : ''}`}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  <TableRow className="bg-muted/60 font-semibold">
                    <TableCell colSpan={6} className="text-right">TOTAL A APLICAR</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmt(pendientes.reduce((s, p) => s + p.saldo, 0))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-mono text-base">
                      RD$ {fmt(totalAplicado)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer sticky con valor + validación + acción */}
      <div className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-card sticky bottom-4">
        <div className="space-y-0.5">
          <div className="text-xs text-muted-foreground">Total a recibir</div>
          <div className="text-2xl font-bold tabular-nums font-mono">RD$ {fmt(totalAplicado)}</div>
        </div>
        {validacion && (
          <div className="flex-1 px-3 py-2 bg-destructive/10 border border-destructive/40 rounded text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {validacion}
          </div>
        )}
        <Button onClick={() => grabarMut.mutate()}
                disabled={!!validacion || grabarMut.isPending}
                size="lg" className="gap-2 min-w-[200px]">
          <Save className="h-4 w-4" />
          {grabarMut.isPending ? 'Grabando…' : 'Grabar Recibo'}
        </Button>
      </div>

      <div className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
        <FileText className="h-3 w-3" />
        Para crear documentos manuales (asientos libres), use la vista de Asiento Contable en Cierre.
      </div>
    </div>
  )
}
