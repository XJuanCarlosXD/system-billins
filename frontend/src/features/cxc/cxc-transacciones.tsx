// FCXC201 — Entrada de Transacciones de Débito y Crédito (clon del legado)
//
// Layout replicado de la captura legacy (Screenshot 2026-05-14 214556.png):
//   Cabecera:  Tipo Docu → autocompleta cuenta/centro/tipo_movi
//              Cliente, Vendedor, Cobrador, Fecha, Plazo, Detalle, Valor D., NCF
//   Tabla 1 "Documentos Afectados": No Docum, Fecha, Val. Pend., ITBIS/ISR Reten.,
//             Valor S/Reten., Valor Apl.   ← marcar facturas a aplicar
//   Tabla 2 "Distribución Contable" (read-only preview):
//             Cuenta · Centro Costo · Nombre Cuenta · Débito · Crédito
//             — auto-generada del tipo_docu + cuenta del cliente
//
// El usuario NO selecciona cuenta: viene de TCXC_TDOCU (FCXC104) por tipo_docu.
import { useMemo, useState, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Save, Printer, AlertCircle, CheckCircle2 } from 'lucide-react'
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
import { ClientePicker } from '@/components/cxc/cliente-picker'

interface P {
  noCia: string
  punto?: string
  /** Precarga desde Vista de Cajero (FAT) para cerrar el pago de una factura a credito. */
  prefill?: { noCliente: string; tipoRef: string; noRef: string }
}

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

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})
const fmtDate = (s: any) => {
  if (!s) return ''
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s).slice(0, 10)
}

// Labels humanos para tipo_transaccion y tipo_movi (TCXC_TDOCU)
const TIPO_TRANS_LABEL: Record<string, string> = {
  I: 'Recibo de Ingreso', A: 'Ajuste', C: 'Nota de Crédito', D: 'Nota de Débito',
  F: 'Factura Crédito', V: 'Devolución',
}
const TIPO_MOVI_LABEL = (v: string) => (v || '').toUpperCase() === 'C' ? 'Crédito' : 'Débito'

export function CxcTransacciones({ noCia, punto = '01', prefill }: P) {
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

  // Vendedores y cobradores
  const vendedoresQ = useQuery({
    queryKey: ['cxc-vendedores', noCia],
    queryFn: () => regalGeneralApi.cxcListVendedores(noCia),
    enabled: !!noCia,
    staleTime: 5 * 60 * 1000,
  })

  // Formas de pago (FAT.TFAT_TIPO_PAGO) — cómo se recibió el dinero del recibo.
  // Se excluye "A CREDITO" (4): un cobro no puede recibirse a crédito.
  const tiposPagoQ = useQuery({
    queryKey: ['fat-tipos-pago', noCia, punto],
    queryFn: () => regalGeneralApi.fatListTiposPago(noCia, punto),
    enabled: !!noCia,
    staleTime: 5 * 60 * 1000,
  })
  const formasPago = useMemo(
    () => ((tiposPagoQ.data?.items ?? []) as any[]).filter(t => String(t.tipo_pago) !== '4'),
    [tiposPagoQ.data],
  )

  // ── Estado del formulario ─────────────────────────────────────────
  const [tipoDoc, setTipoDoc] = useState('')
  const [fecha, setFecha] = useState(today)
  const [cliente, setCliente] = useState<any | null>(null)
  const [vendedor, setVendedor] = useState('')
  const [cobrador, setCobrador] = useState('')
  const [plazo, setPlazo] = useState(0)
  const [formaPago, setFormaPago] = useState('1') // 1 = EFECTIVO (default legado)
  const [ncf, setNcf] = useState('')
  const [detalle, setDetalle] = useState('')
  const [valorDoc, setValorDoc] = useState(0)
  const [aplicaciones, setAplicaciones] = useState<Record<string, number>>({})
  const [retenciones, setRetenciones] = useState<Record<string, { itbis: number; isr: number }>>({})
  const [ultimoNoDoc, setUltimoNoDoc] = useState<string | null>(null)

  // La numeracion es POR TIPO (TCXC_SECUENCIA) — sin tipoDoc todavia elegido
  // no hay "proximo numero" valido que mostrar.
  const nextDocQ = useQuery({
    queryKey: ['cxc-next-doc', noCia, punto, tipoDoc],
    queryFn: () => regalGeneralApi.cxcGetNextDoc(noCia, punto, tipoDoc),
    enabled: !!noCia && !!tipoDoc,
  })

  const tdocusActivos = useMemo(() => (tdocusQ.data ?? []).filter((t: any) => t.activo === 'S'), [tdocusQ.data])
  const tipoDocSel = useMemo(() => tdocusActivos.find((t: any) => t.tipo_doc === tipoDoc), [tdocusActivos, tipoDoc])
  const tipoMov = (tipoDocSel?.tipo_movimiento || '').toUpperCase()
  const tipoTrans = tipoDocSel?.tipo_transaccion || ''
  const requiereNcf = !!tipoDocSel?.codigo_ncf
  // Los recibos de ingreso (tipo_transaccion='I') piden cómo se recibió el
  // dinero — el Cuadre de Caja desglosa los cobros RI por esta forma de pago.
  const pideFormaPago = (tipoTrans || '').toUpperCase() === 'I'

  // Cuando cambia el cliente, autocompletar vendedor/cobrador si vienen del maestro
  useEffect(() => {
    if (cliente) {
      if (cliente.vendedor && !vendedor) setVendedor(String(cliente.vendedor).trim())
      if (cliente.cobrador && !cobrador) setCobrador(String(cliente.cobrador).trim())
    }
    setAplicaciones({})
    setRetenciones({})
  }, [cliente?.no_cliente])

  // ── Facturas pendientes del cliente ──────────────────────────────
  const pendientesQ = useQuery({
    queryKey: ['cxc-pendientes', noCia, cliente?.no_cliente, punto],
    queryFn: () => regalGeneralApi.cxcFacturasPendientesCliente(noCia, String(cliente!.no_cliente), punto),
    enabled: !!cliente,
  })
  const pendientes: FacturaPendiente[] = (pendientesQ.data as any[]) ?? []

  // ── Precarga desde Vista de Cajero ────────────────────────────────
  // Paso 1: en cuanto cargan los tipos de documento, elige el Recibo de
  // Ingreso (tipo_transaccion='I', prefiere codigo 'RI'), llena el detalle
  // y busca el cliente exacto por codigo (mismo lookup que ClientePicker).
  // Default rápido: al entrar, preseleccionar el Recibo de Ingreso (el tipo
  // más usado) para no tener que elegirlo cada vez. Solo si NO viene de la
  // vista de cajero (prefill lo maneja aparte) y el usuario aún no eligió.
  useEffect(() => {
    if (prefill || tipoDoc || tdocusQ.isLoading || tdocusActivos.length === 0) return
    const def =
      tdocusActivos.find((t: any) => t.tipo_doc === 'RI' && (t.tipo_transaccion || '').toUpperCase() === 'I') ||
      tdocusActivos.find((t: any) => (t.tipo_transaccion || '').toUpperCase() === 'I') ||
      tdocusActivos[0]
    if (def) setTipoDoc(def.tipo_doc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill, tdocusActivos, tdocusQ.isLoading])

  const prefillSetupRef = useRef(false)
  useEffect(() => {
    if (!prefill || prefillSetupRef.current || tdocusQ.isLoading) return
    prefillSetupRef.current = true
    const ri = tdocusActivos.find((t: any) => t.tipo_doc === 'RI' && (t.tipo_transaccion || '').toUpperCase() === 'I')
      || tdocusActivos.find((t: any) => (t.tipo_transaccion || '').toUpperCase() === 'I')
    if (ri) setTipoDoc(ri.tipo_doc)
    else toast.error('No hay un tipo de documento de Recibo de Ingreso activo configurado.')
    setDetalle(`Pago factura ${prefill.tipoRef}-${prefill.noRef}`)
    regalGeneralApi.cxcListClientes(noCia, prefill.noCliente, 1)
      .then((res: any) => {
        const items = (res?.items as any[]) || []
        const exact = items.find((c) => String(c.no_cliente).trim() === String(prefill.noCliente).trim())
        if (exact) setCliente(exact)
        else toast.error(`Cliente ${prefill.noCliente} no encontrado para precargar el pago.`)
      })
      .catch(() => toast.error('No se pudo cargar el cliente para precargar el pago.'))
  }, [prefill, tdocusActivos, tdocusQ.isLoading, noCia])

  // Paso 2: una vez cargan las facturas pendientes del cliente precargado,
  // marca la factura de origen aplicada por su saldo total (editable).
  const prefillApplyRef = useRef(false)
  useEffect(() => {
    if (!prefill || prefillApplyRef.current) return
    if (!cliente || String(cliente.no_cliente).trim() !== String(prefill.noCliente).trim()) return
    if (pendientesQ.isLoading) return
    prefillApplyRef.current = true
    const match = pendientes.find(p => p.tipo_doc === prefill.tipoRef && p.no_doc === prefill.noRef)
    if (match) {
      setAplicaciones(prev => ({ ...prev, [`${match.tipo_doc}-${match.no_doc}`]: match.saldo }))
    } else {
      toast.info('La factura ya no tiene saldo pendiente en CxC (puede que ya este pagada).')
    }
  }, [prefill, cliente, pendientesQ.isLoading, pendientes])

  // ── Cálculos ──────────────────────────────────────────────────────
  const totalAplicado = useMemo(
    () => Object.values(aplicaciones).reduce((s, n) => s + (Number(n) || 0), 0),
    [aplicaciones],
  )
  // Si el usuario no fijó manualmente Valor D., usar el total aplicado
  const totalItbisRetenido = useMemo(
    () => Object.values(retenciones).reduce((s, r) => s + (Number(r.itbis) || 0), 0),
    [retenciones],
  )
  const totalIsrRetenido = useMemo(
    () => Object.values(retenciones).reduce((s, r) => s + (Number(r.isr) || 0), 0),
    [retenciones],
  )
  const totalRetenido = totalItbisRetenido + totalIsrRetenido
  const valorEfectivo = valorDoc > 0 ? valorDoc : totalAplicado
  const pagoEnEfectivo = Math.max(valorEfectivo - totalRetenido, 0)
  const diferencia = valorEfectivo - totalAplicado

  const periodoMesAno = puntoQ.data
    ? `${MESES[(puntoQ.data.mes_proceso || 1) - 1]} ${puntoQ.data.ano_proceso}`
    : ''
  const fechaFueraDePeriodo = useMemo(() => {
    if (!puntoQ.data || !fecha) return false
    const [y, m] = fecha.split('-').map(Number)
    return y !== puntoQ.data.ano_proceso || m !== puntoQ.data.mes_proceso
  }, [fecha, puntoQ.data])

  // ── Distribución contable auto-generada (preview read-only) ──────
  // Sigue regla legado:
  //   Cuenta del tipo_docu (ej. 1101-01 CAJA) → DR por valor
  //   Cuenta CxC del cliente (de TCXC_TCONTABLE, default 1103-01) → CR por valor
  const distribContable = useMemo(() => {
    if (!tipoDocSel || valorEfectivo <= 0) return []
    const cuentaTipoDoc = tipoDocSel.cuenta || ''
    const ccTipoDoc = tipoDocSel.centro_costo || '0000000000'
    // Cuenta CxC del cliente: legado por convención 1103-01 cuando es CR
    const cuentaCxC = '1103-01'  // se resuelve real en backend con TCXC_TCONTABLE
    return [
      cuentaTipoDoc && {
        cuenta: cuentaTipoDoc, centro_costo: ccTipoDoc,
        nombre: '(cuenta default del tipo de documento)',
        debito: tipoMov === 'C' ? pagoEnEfectivo : 0,
        credito: tipoMov === 'D' ? valorEfectivo : 0,
      },
      totalItbisRetenido > 0 && {
        cuenta: '2106-02', centro_costo: ccTipoDoc,
        nombre: 'ITBIS retenido',
        debito: totalItbisRetenido,
        credito: 0,
      },
      totalIsrRetenido > 0 && {
        cuenta: '2106-01', centro_costo: ccTipoDoc,
        nombre: 'ISR retenido',
        debito: totalIsrRetenido,
        credito: 0,
      },
      cliente && {
        cuenta: cuentaCxC, centro_costo: '0000000000',
        nombre: `CxC ${cliente.nombre || cliente.no_cliente}`,
        debito: tipoMov === 'D' ? valorEfectivo : 0,
        credito: tipoMov === 'C' ? valorEfectivo : 0,
      },
    ].filter(Boolean) as Array<{ cuenta: string; centro_costo: string; nombre: string; debito: number; credito: number }>
  }, [tipoDocSel, valorEfectivo, tipoMov, cliente, pagoEnEfectivo, totalItbisRetenido, totalIsrRetenido])

  const totalDistribDR = distribContable.reduce((s, l) => s + l.debito, 0)
  const totalDistribCR = distribContable.reduce((s, l) => s + l.credito, 0)
  const distribCuadra = Math.abs(totalDistribDR - totalDistribCR) < 0.01

  // ── Mutación grabar ────────────────────────────────────────────────
  const grabarMut = useMutation({
    mutationFn: async () => {
      const apl = pendientes
        .map(p => {
          const key = `${p.tipo_doc}-${p.no_doc}`
          const monto = Number(aplicaciones[key] || 0)
          const reten = retenciones[key] || { itbis: 0, isr: 0 }
          return monto > 0
            ? {
                tipo_ref: p.tipo_doc,
                no_ref: p.no_doc,
                monto,
                itbis_retenido: Number(reten.itbis || 0),
                isr_retenido: Number(reten.isr || 0),
              }
            : null
        })
        .filter(Boolean) as Array<{
          tipo_ref: string
          no_ref: string
          monto: number
          itbis_retenido: number
          isr_retenido: number
        }>
      return regalGeneralApi.cxcCrearRecibo({
        no_cia: noCia, punto,
        tipo_doc: tipoDoc, no_cliente: String(cliente!.no_cliente),
        fecha, ncf, detalle,
        vendedor, cobrador, plazo,
        forma_pago: pideFormaPago ? formaPago : '',
        valor_doc: valorEfectivo,
        aplicaciones: apl,
      })
    },
    onSuccess: (r: any) => {
      const noDoc = r?.no_doc || nextDocQ.data?.no_doc || ''
      setUltimoNoDoc(noDoc)
      const ncfSuffix = r?.ncf_dgi ? ` · NCF ${r.ncf_dgi}` : ''
      toast.success(`Documento ${tipoDoc}-${noDoc} grabado correctamente · RD$ ${fmt(r.total)}${ncfSuffix}`)
      qc.invalidateQueries({ queryKey: ['cxc-next-doc', noCia, punto] })
      qc.invalidateQueries({ queryKey: ['cxc-pendientes', noCia, cliente?.no_cliente] })
      qc.invalidateQueries({ queryKey: ['cxc-documentos'] })
      setCliente(null); setNcf(''); setDetalle('')
      setAplicaciones({}); setRetenciones({}); setValorDoc(0); setFecha(today)
      setPlazo(0); setFormaPago('1')
    },
    onError: (e: Error) => toast.error(e.message || 'Error al grabar'),
  })

  // ── Validación ─────────────────────────────────────────────────────
  const validar = (): string | null => {
    if (!tipoDoc) return 'Seleccione el tipo de documento'
    if (!cliente) return 'Seleccione un cliente'
    if (pideFormaPago && !formaPago)
      return 'Indique la forma de pago (cómo se recibió el dinero)'
    if (fechaFueraDePeriodo) return `La fecha debe estar dentro del período activo (${periodoMesAno})`
    if (valorEfectivo <= 0) return 'Indique el valor del documento o aplique a alguna factura'
    for (const p of pendientes) {
      const key = `${p.tipo_doc}-${p.no_doc}`
      const m = Number(aplicaciones[key] || 0)
      const reten = retenciones[key] || { itbis: 0, isr: 0 }
      const itbis = Number(reten.itbis || 0)
      const isr = Number(reten.isr || 0)
      if (itbis < 0 || isr < 0) {
        return `Retencion negativa en ${p.no_doc_display}`
      }
      if (itbis + isr > m + 0.001) {
        return `La retencion en ${p.no_doc_display} no puede exceder el valor aplicado`
      }
      if (m > p.saldo + 0.001) {
        return `Monto en ${p.no_doc_display} (RD$ ${fmt(m)}) excede su saldo (RD$ ${fmt(p.saldo)})`
      }
    }
    if (!distribCuadra) return 'La distribución contable no cuadra'
    return null
  }
  const validacion = validar()

  // Acciones tabla
  const setMonto = (key: string, m: number) =>
    setAplicaciones(prev => ({ ...prev, [key]: m }))
  const setRetencion = (key: string, field: 'itbis' | 'isr', value: number) =>
    setRetenciones(prev => ({
      ...prev,
      [key]: { itbis: 0, isr: 0, ...(prev[key] || {}), [field]: value },
    }))
  const toggleFactura = (p: FacturaPendiente, check: boolean) =>
    setMonto(`${p.tipo_doc}-${p.no_doc}`, check ? p.saldo : 0)
  const seleccionarTodo = () => {
    const next: Record<string, number> = {}
    for (const p of pendientes) next[`${p.tipo_doc}-${p.no_doc}`] = p.saldo
    setAplicaciones(next)
  }
  const limpiarTodo = () => {
    setAplicaciones({})
    setRetenciones({})
  }

  // Mapea el tipo legacy al codigo del registry de plantillas PDF.
  const codigoPlantillaPorTipo = (tipo: string): string => {
    switch ((tipo || '').toUpperCase()) {
      case 'RI': return 'recibo-cobro'
      case 'NC': return 'cxc-nota-credito'
      case 'ND': return 'cxc-nota-debito'
      case 'CD': return 'cxc-cheque-devuelto'
      case 'AC': return 'cxc-ajuste-credito'
      case 'AD': return 'cxc-ajuste-debito'
      case 'DV': return 'cxc-devolucion'
      case 'AF': return 'cxc-anulacion-factura'
      case 'BI': return 'cxc-balance-inicial'
      default: return 'recibo-cobro'
    }
  }

  const imprimirUltimo = () => {
    if (!ultimoNoDoc) return
    const qs = new URLSearchParams({ no_cia: noCia, punto }).toString()
    const codigo = codigoPlantillaPorTipo(tipoDoc)
    window.open(`/print/${codigo}/${encodeURIComponent(ultimoNoDoc)}?${qs}`, '_blank', 'noopener')
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header / contexto */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Entrada de Transacciones de Débito y Crédito</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Recibos de ingreso, notas de crédito/débito, ajustes. Equivale a la forma legada
                <i> Fcxc201</i>. La cuenta contable se toma del Tipo de Documento (configurado en
                Mantenimiento Tipo de Documento — Fcxc104).
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {prefill && (
                <Badge className="bg-blue-600 text-xs">
                  Prellenado desde Vista de Cajero: {prefill.tipoRef}-{prefill.noRef}
                </Badge>
              )}
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
          {/* Fila 1: Tipo Docu + Fecha + Plazo */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
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
                      <Badge variant={(t.tipo_movimiento || '').toUpperCase() === 'C' ? 'default' : 'secondary'}
                             className="ml-2 text-[10px] px-1">
                        {TIPO_MOVI_LABEL(t.tipo_movimiento)}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tipoDocSel && (
                <p className="text-[11px] text-muted-foreground">
                  <b>{TIPO_TRANS_LABEL[tipoTrans] || tipoTrans || '—'}</b> ·
                  Movimiento <b>{TIPO_MOVI_LABEL(tipoMov)}</b> ·
                  Cuenta default <span className="font-mono">{tipoDocSel.cuenta || '—'}</span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha *</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="h-9" />
              {fechaFueraDePeriodo && (
                <p className="text-[11px] text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Fuera del período activo
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Plazo (días)</Label>
              <Input type="number" min={0} value={plazo || ''} onChange={e => setPlazo(Number(e.target.value || 0))}
                     className="h-9 font-mono" />
            </div>
          </div>

          {/* Fila 2: Cliente */}
          <div className="space-y-1.5">
            <Label className="text-xs">Cliente *</Label>
            <ClientePicker noCia={noCia} cliente={cliente} onChange={setCliente} />
          </div>

          {/* Fila 3: Vendedor + Cobrador + Forma de pago (solo recibos) */}
          <div className={`grid grid-cols-1 gap-3 ${pideFormaPago ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            <div className="space-y-1.5">
              <Label className="text-xs">Vendedor</Label>
              <Select value={vendedor} onValueChange={setVendedor}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="(opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin vendedor —</SelectItem>
                  {(vendedoresQ.data ?? []).map((v: any) => (
                    <SelectItem key={v.vendedor} value={String(v.vendedor)}>
                      <span className="font-mono mr-2">{v.vendedor}</span>{v.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cobrador</Label>
              <Input value={cobrador} onChange={e => setCobrador(e.target.value)}
                     placeholder="Código cobrador (opcional)" className="h-9 font-mono" />
            </div>
            {pideFormaPago && (
              <div className="space-y-1.5">
                <Label className="text-xs">Forma de pago *</Label>
                <Select value={formaPago} onValueChange={setFormaPago}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="¿Cómo se recibió el pago?" />
                  </SelectTrigger>
                  <SelectContent>
                    {formasPago.map((t: any) => (
                      <SelectItem key={t.tipo_pago} value={String(t.tipo_pago)}>
                        <span className="font-mono mr-2">{t.tipo_pago}</span>
                        {t.descripcion}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Cómo se recibió el dinero. Así se desglosa en el Cuadre de Caja.
                </p>
              </div>
            )}
          </div>

          {/* Fila 4: NCF + Detalle + Valor D. */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {requiereNcf && (
              <div className="space-y-1.5">
                <Label className="text-xs">NCF <span className="text-muted-foreground">({tipoDocSel?.codigo_ncf})</span></Label>
                <Input value="Se genera automáticamente al guardar" disabled readOnly
                       className="h-9 text-muted-foreground italic" />
              </div>
            )}
            <div className={`space-y-1.5 ${requiereNcf ? 'sm:col-span-2' : 'sm:col-span-3'}`}>
              <Label className="text-xs">Detalle / Concepto</Label>
              <Input value={detalle} onChange={e => setDetalle(e.target.value)}
                     placeholder="Ej. PAGO" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor del documento</Label>
              <Input type="number" step="0.01" min={0} value={valorDoc || ''}
                     onChange={e => setValorDoc(Number(e.target.value || 0))}
                     placeholder={`Auto: ${fmt(totalAplicado)}`}
                     className="h-9 text-right tabular-nums font-mono" />
              <p className="text-[11px] text-muted-foreground">
                Vacío = suma de "Valor Aplicado" de la tabla.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla "Documentos Afectados" */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base">Documentos Afectados</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Facturas pendientes del cliente a las que se aplica este recibo
                (TCXC_REFEDOCU). El monto no puede exceder el saldo.
              </p>
            </div>
            {cliente && pendientes.length > 0 && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={seleccionarTodo}>Aplicar a todas</Button>
                <Button size="sm" variant="ghost" onClick={limpiarTodo}>Limpiar</Button>
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
            <div className="text-center py-10 text-sm text-muted-foreground">Cargando…</div>
          )}
          {cliente && !pendientesQ.isLoading && pendientes.length === 0 && (
            <div className="text-center py-10 text-sm border rounded bg-muted/30">
              <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-2" />
              El cliente <b>{cliente.nombre}</b> no tiene facturas pendientes.
            </div>
          )}
          {cliente && pendientes.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-12 text-center">Apl.</TableHead>
                    <TableHead className="w-32">No. Docum.</TableHead>
                    <TableHead className="w-28">Fecha</TableHead>
                    <TableHead className="w-32 text-right">Val. Pend.</TableHead>
                    <TableHead className="w-28 text-right">ITBIS Reten.</TableHead>
                    <TableHead className="w-28 text-right">ISR Reten.</TableHead>
                    <TableHead className="w-32 text-right">Valor S/Reten.</TableHead>
                    <TableHead className="w-32 text-right">Valor Apl.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendientes.map(p => {
                    const key = `${p.tipo_doc}-${p.no_doc}`
                    const monto = Number(aplicaciones[key] || 0)
                    const reten = retenciones[key] || { itbis: 0, isr: 0 }
                    const itbisRetenido = Number(reten.itbis || 0)
                    const isrRetenido = Number(reten.isr || 0)
                    const valorSinReten = Math.max(monto - itbisRetenido - isrRetenido, 0)
                    const checked = monto > 0
                    const excedeSaldo = monto > p.saldo + 0.001
                    const excedeReten = itbisRetenido + isrRetenido > monto + 0.001
                    return (
                      <TableRow key={key} className={checked ? 'bg-green-50/40 dark:bg-green-950/10' : ''}>
                        <TableCell className="text-center">
                          <Checkbox checked={checked} onCheckedChange={(v: any) => toggleFactura(p, !!v)} />
                        </TableCell>
                        <TableCell className="font-mono text-sm font-semibold">
                          {p.no_doc_display}
                        </TableCell>
                        <TableCell className="tabular-nums text-sm">{fmtDate(p.fecha)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-amber-700">
                          {fmt(p.saldo)}
                        </TableCell>
                        <TableCell>
                          <Input type="number" step="0.01" min="0" max={monto}
                            value={itbisRetenido || ''}
                            onChange={e => setRetencion(key, 'itbis', Number(e.target.value || 0))}
                            placeholder="0.00"
                            className={`h-8 text-right tabular-nums font-mono ${excedeReten ? 'border-destructive' : ''}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input type="number" step="0.01" min="0" max={monto}
                            value={isrRetenido || ''}
                            onChange={e => setRetencion(key, 'isr', Number(e.target.value || 0))}
                            placeholder="0.00"
                            className={`h-8 text-right tabular-nums font-mono ${excedeReten ? 'border-destructive' : ''}`}
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(valorSinReten)}</TableCell>
                        <TableCell>
                          <Input type="number" step="0.01" min="0" max={p.saldo}
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
                    <TableCell colSpan={3} className="text-right">TOTALES</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmt(pendientes.reduce((s, p) => s + p.saldo, 0))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-mono">
                      {fmt(totalItbisRetenido)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-mono">
                      {fmt(totalIsrRetenido)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      Efectivo RD$ {fmt(pagoEnEfectivo)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-mono">
                      RD$ {fmt(totalAplicado)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabla "Distribución Contable" (read-only preview) */}
      {tipoDocSel && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Distribución Contable</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Asientos generados automáticamente. Se cuadran cuando seleccione el tipo
                  de documento y un cliente.
                </p>
              </div>
              {valorEfectivo > 0 && (
                distribCuadra
                  ? <Badge className="bg-green-600">Cuadra</Badge>
                  : <Badge variant="destructive">Diferencia RD$ {fmt(Math.abs(totalDistribDR - totalDistribCR))}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-32">Cuenta</TableHead>
                    <TableHead className="w-32">Centro Costo</TableHead>
                    <TableHead>Nombre Cuenta</TableHead>
                    <TableHead className="w-36 text-right">Débito</TableHead>
                    <TableHead className="w-36 text-right">Crédito</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {distribContable.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">
                        Seleccione tipo de documento y cliente, e indique un valor.
                      </TableCell>
                    </TableRow>
                  )}
                  {distribContable.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">{l.cuenta}</TableCell>
                      <TableCell className="font-mono text-xs">{l.centro_costo}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.nombre}</TableCell>
                      <TableCell className="text-right tabular-nums font-mono">
                        {l.debito > 0 ? fmt(l.debito) : ''}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-mono">
                        {l.credito > 0 ? fmt(l.credito) : ''}
                      </TableCell>
                    </TableRow>
                  ))}
                  {distribContable.length > 0 && (
                    <TableRow className="bg-muted/60 font-semibold">
                      <TableCell colSpan={3} className="text-right">Diferencia: RD$ {fmt(Math.abs(totalDistribDR - totalDistribCR))}</TableCell>
                      <TableCell className="text-right tabular-nums">RD$ {fmt(totalDistribDR)}</TableCell>
                      <TableCell className="text-right tabular-nums">RD$ {fmt(totalDistribCR)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer sticky */}
      <div className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-card sticky bottom-4">
        <div className="space-y-0.5">
          <div className="text-xs text-muted-foreground">Valor del documento</div>
          <div className="text-2xl font-bold tabular-nums font-mono">RD$ {fmt(valorEfectivo)}</div>
          {totalRetenido > 0 && (
            <div className="text-[11px] text-muted-foreground">
              Efectivo RD$ {fmt(pagoEnEfectivo)} · Retenido RD$ {fmt(totalRetenido)}
            </div>
          )}
          {Math.abs(diferencia) > 0.01 && (
            <div className="text-[11px] text-amber-700">
              Diferencia vs aplicado: RD$ {fmt(Math.abs(diferencia))}
            </div>
          )}
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
          {grabarMut.isPending ? 'Grabando…' : 'Grabar Documento'}
        </Button>
      </div>
    </div>
  )
}
