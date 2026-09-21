import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { useEnterAdvancesFocus } from '@/hooks/use-enter-advances-focus'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Search, Save, Wallet } from 'lucide-react'
import {
  MovimientoContableGrid,
  filaVacia,
  type LineaContable,
} from '@/components/shared/movimiento-contable-grid'

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type Beneficiario = {
  no_bene: string
  nombre: string
  rnc?: string
  tipo_desc?: string
}

function BeneficiarioPicker({
  value,
  onChange,
}: {
  value: Beneficiario | null
  onChange: (b: Beneficiario | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const benesQ = useQuery({
    queryKey: ['acc-bene-pick', search],
    queryFn: () => api.accListBeneficiarios({ activo: 'S', search }),
    enabled: open,
  })

  return (
    <div className="space-y-1">
      <Label className="text-xs">Beneficiario *</Label>
      <div className="flex items-center gap-2">
        <Input
          value={value?.no_bene ?? ''}
          readOnly
          placeholder="—"
          className="h-9 w-32 font-mono"
        />
        <Button type="button" variant="outline" size="sm" className="h-9"
                onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}>
          <Search className="h-4 w-4" />
        </Button>
        {value ? (
          <div className="flex flex-1 flex-wrap items-center gap-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm">
            <div className="min-w-0">
              <div className="text-[10px] uppercase text-emerald-600">Nombre</div>
              <div className="truncate font-medium text-emerald-900">{value.nombre}</div>
            </div>
            {value.tipo_desc && (
              <div>
                <div className="text-[10px] uppercase text-emerald-600">Tipo</div>
                <div className="text-emerald-800">{value.tipo_desc}</div>
              </div>
            )}
            {value.rnc && (
              <div>
                <div className="text-[10px] uppercase text-emerald-600">RNC / Cédula</div>
                <div className="font-mono text-emerald-800">{value.rnc}</div>
              </div>
            )}
            <Button type="button" size="sm" variant="ghost"
                    className="ml-auto text-muted-foreground hover:text-destructive"
                    onClick={() => onChange(null)}>
              Cambiar
            </Button>
          </div>
        ) : (
          <div className="flex h-9 flex-1 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">
            Usa la lupa para buscar el beneficiario.
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="picker">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>Buscar Beneficiario</DialogTitle>
          </DialogHeader>
          <div className="shrink-0 border-b bg-background px-6 py-3">
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre, código o RNC…"
              className="h-11 text-base"
              autoFocus
            />
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="w-24">Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="w-36">Tipo</TableHead>
                  <TableHead className="w-36">RNC / Cédula</TableHead>
                  <TableHead className="w-24 text-center">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(benesQ.data || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                      {benesQ.isFetching ? 'Buscando…' : 'Sin resultados'}
                    </TableCell>
                  </TableRow>
                ) : (
                  (benesQ.data || []).map((b: any) => (
                    <TableRow key={b.no_bene} className="cursor-pointer hover:bg-muted/40"
                              onClick={() => { onChange(b); setOpen(false); setSearch('') }}>
                      <TableCell className="font-mono text-xs">{b.no_bene}</TableCell>
                      <TableCell>{b.nombre}</TableCell>
                      <TableCell>{b.tipo_desc || ''}</TableCell>
                      <TableCell className="font-mono text-xs">{b.rnc || ''}</TableCell>
                      <TableCell className="text-center">
                        <Button type="button" size="sm" variant="outline">Elegir</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function AccNuevoEgreso({ editNoDocu }: { editNoDocu?: string } = {}) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { selectedCompany, selectedPoint } = useCompany()
  const modoEdicion = !!editNoDocu

  const cajasQ = useQuery({
    queryKey: ['acc-cajas-egreso', selectedCompany, selectedPoint],
    queryFn: () => api.accListCajas(selectedCompany, selectedPoint),
  })
  const gastosQ = useQuery({
    queryKey: ['acc-tipos-gasto'],
    queryFn: () => api.accListTiposGasto(),
  })
  // Forma de Pago y Tipo de Gasto DGII: campos reales de Facc201
  // (TACC_DOCUMENTO.FORMA_PAGO / TIPO_GASTO_DGII) que el clon nunca exponía
  // -- FORMA_PAGO estaba poblado en 2,875/2,876 documentos históricos (99.97%)
  // pero el código mandaba un 1 fijo; TIPO_GASTO_DGII/FECHA_VENCE_NCF están
  // poblados en el 90%+ de los documentos que sí llevan NCF (obligatorios ahí
  // en el legado: "Si digitó un NCF, debe digitar la forma de pago / el tipo
  // de gasto para la DGII"). Mismos catálogos que ya usa CxP.
  const formasPagoQ = useQuery({
    queryKey: ['acc-formas-pago'],
    queryFn: () => api.cxpListFormasPago(),
  })
  const tiposGastoDgiiQ = useQuery({
    queryKey: ['acc-tipos-gasto-dgii'],
    queryFn: () => api.cxpListTiposGasto(),
  })
  // Editar (botón "Editar" de Consulta de Documentos): esta misma pantalla
  // se precarga con el documento existente y, al guardar, manda no_docu en
  // el payload -- acc_repo.crear_documento hace UPDATE en el mismo no_docu
  // en vez de reservar uno nuevo de la secuencia (mismo patrón que
  // cxp_repo.entrada_documento en modo edición: no se "salta" ningún número).
  const editDocQ = useQuery({
    enabled: modoEdicion && !!selectedCompany && !!selectedPoint,
    queryKey: ['acc-doc-editar', selectedCompany, selectedPoint, editNoDocu],
    queryFn: () => api.accGetDocumento(selectedCompany, selectedPoint, editNoDocu!),
  })

  const [noCaja, setNoCaja] = useState('')
  const [tipoGasto, setTipoGasto] = useState('')
  const [beneficiario, setBeneficiario] = useState<Beneficiario | null>(null)
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [valor, setValor] = useState('')
  const [impuesto, setImpuesto] = useState('')
  // ITBIS calculado a partir del valor con la tasa de la empresa (misma
  // fuente y mismo patrón que CxP — Entrada de Documentos: TCNT_CIAS.ITBIS,
  // 18% por defecto si la empresa no tiene el dato). El usuario puede
  // editarlo a mano (botón "editar"/"auto"); mientras no lo toque, se
  // recalcula solo cuando cambia el Valor.
  const [porcItbis, setPorcItbis] = useState(18)
  const [editandoItbis, setEditandoItbis] = useState(false)
  const [ncf, setNcf] = useState('')
  const [rnc, setRnc] = useState('')
  const [detalle, setDetalle] = useState('')
  const [noFormulario, setNoFormulario] = useState('')
  const [formaPago, setFormaPago] = useState('')
  const [tipoGastoDgii, setTipoGastoDgii] = useState('')
  const [fechaVenceNcf, setFechaVenceNcf] = useState('')

  useEffect(() => {
    if (formaPago || !formasPagoQ.data?.length) return
    const def = formasPagoQ.data.find((f) => f.por_defecto === 'S') || formasPagoQ.data[0]
    if (def) setFormaPago(String(def.forma_pago))
  }, [formasPagoQ.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const ncfRequiereDgii = !!ncf.trim()

  useEffect(() => {
    if (!selectedCompany) return
    api.cntGetCia(selectedCompany)
      .then((c: any) => {
        const p = Number(c?.itbis ?? c?.porc_impuesto ?? 18)
        if (p > 0) setPorcItbis(p)
      })
      .catch(() => { /* queda en 18 por defecto */ })
  }, [selectedCompany])

  const cajaSel = (cajasQ.data || []).find((c: any) => c.no_caja === noCaja && c.activa === 'S')
  const gastoSel = (gastosQ.data || []).find((g: any) => g.tipo_gasto === tipoGasto)

  const valorNum = Number(valor || 0)
  const impuestoNum = Number(impuesto || 0)
  const total = valorNum + impuestoNum

  useEffect(() => {
    if (editandoItbis) return
    if (!valorNum) { setImpuesto(''); return }
    setImpuesto((valorNum * (porcItbis / 100)).toFixed(2))
  }, [valorNum, porcItbis, editandoItbis])

  // Cuenta de ITBIS deducible de la compañía (misma cuenta que usa CxP,
  // 2106-02 en el 92% de los egresos históricos con impuesto en ACC) --
  // cuando hay ITBIS, el legado siempre generaba una línea de débito
  // automática a esta cuenta, además de la(s) de gasto que elige el usuario.
  const cuentaItbisQ = useQuery({
    queryKey: ['acc-cuenta-itbis', selectedCompany],
    queryFn: () => api.cxpGetCuentaItbisDefault(selectedCompany),
    enabled: impuestoNum > 0,
  })

  // Distribución contable del egreso -- misma grilla y mismo modelo que
  // CxP — Entrada de Documentos (Fcxp201/Fcxp210): una lista plana de líneas
  // Débito/Crédito, todas editables por el usuario. Se sugieren de entrada
  // la cuenta de gasto del tipo elegido (débito), el ITBIS deducible si hay
  // impuesto (débito) y la cuenta de la caja por el total (crédito) -- el
  // legado (Facc201) permitía repartir el gasto entre 2-3 cuentas y no
  // forzaba la cuenta de crédito, así que nada aquí queda bloqueado.
  const [lineas, setLineas] = useState<LineaContable[]>([filaVacia()])
  const [lineasTocadas, setLineasTocadas] = useState(false)
  useEffect(() => {
    if (lineasTocadas || !gastoSel || !cajaSel) return
    const sugeridas: LineaContable[] = [{
      cuenta: gastoSel.cuenta || '',
      centroCosto: gastoSel.centro_costo || '0000000000',
      debito: valor || '',
      credito: '',
    }]
    if (impuestoNum > 0 && cuentaItbisQ.data?.cuenta) {
      sugeridas.push({
        cuenta: cuentaItbisQ.data.cuenta,
        centroCosto: '0000000000',
        debito: impuesto || '',
        credito: '',
      })
    }
    sugeridas.push({
      cuenta: cajaSel.cuenta,
      centroCosto: '0000000000',
      debito: '',
      credito: String(total),
    })
    setLineas(sugeridas)
  }, [gastoSel?.cuenta, gastoSel?.centro_costo, cajaSel?.cuenta, valor, impuesto, cuentaItbisQ.data?.cuenta, lineasTocadas]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalDebitoLineas = lineas.reduce((s, l) => s + Number(l.debito || 0), 0)
  const totalCreditoLineas = lineas.reduce((s, l) => s + Number(l.credito || 0), 0)
  const distribucionCuadra = lineas.some((l) => l.cuenta && (Number(l.debito || 0) > 0 || Number(l.credito || 0) > 0))
    && Math.abs(totalDebitoLineas - totalCreditoLineas) < 0.01

  // Si selecciona beneficiario con RNC y aún no llenó RNC manual, autocompletar.
  useEffect(() => {
    if (beneficiario?.rnc && !rnc) setRnc(beneficiario.rnc)
  }, [beneficiario?.rnc])

  // Precarga del documento en modo edición (equivalente a cxp_procesos'
  // useEffect de modoEdicion): VALOR guardado es el total desembolsado, aquí
  // se separa de vuelta en neto (para el campo Valor) + impuesto.
  useEffect(() => {
    const cab = editDocQ.data?.cabecera
    if (!cab) return
    setNoCaja(cab.no_caja || '')
    setTipoGasto(cab.tipo_gasto || '')
    setBeneficiario({
      no_bene: cab.no_bene || '',
      nombre: cab.nombre_bene || '',
    })
    setFecha((cab.fecha || '').slice(0, 10) || new Date().toISOString().slice(0, 10))
    const impuestoCab = Number(cab.impuesto || 0)
    setValor(String(Number(cab.valor || 0) - impuestoCab))
    setImpuesto(String(impuestoCab))
    setEditandoItbis(true)
    const posNcf = (cab.posiciones_fijas_ncf || '').toString().trim().toUpperCase()
    setNcf(cab.ncf != null && cab.ncf !== '' ? `${posNcf}${String(cab.ncf).padStart(8, '0')}` : '')
    setRnc(cab.rnc || '')
    setDetalle(cab.detalle || '')
    setNoFormulario(cab.no_formulario || '')
    setFormaPago(cab.forma_pago != null ? String(cab.forma_pago) : '')
    setTipoGastoDgii(cab.tipo_gasto_dgii || '')
    setFechaVenceNcf((cab.fecha_vence_ncf || '').slice(0, 10))
    const lineasCargadas: LineaContable[] = (editDocQ.data?.lineas || []).map((l: any) => ({
      cuenta: l.cuenta || '',
      centroCosto: l.centro_costo || '',
      debito: l.tipo_movi === 'D' ? String(l.monto) : '',
      credito: l.tipo_movi === 'C' ? String(l.monto) : '',
    }))
    setLineas(lineasCargadas.length > 0 ? lineasCargadas : [filaVacia()])
    setLineasTocadas(true)
  }, [editDocQ.data])

  const reset = () => {
    setBeneficiario(null); setTipoGasto(''); setValor('');
    setImpuesto(''); setEditandoItbis(false); setNcf(''); setRnc(''); setDetalle('')
    setNoFormulario(''); setTipoGastoDgii(''); setFechaVenceNcf('')
    const def = formasPagoQ.data?.find((f) => f.por_defecto === 'S') || formasPagoQ.data?.[0]
    setFormaPago(def ? String(def.forma_pago) : '')
    setFecha(new Date().toISOString().slice(0, 10))
    setLineas([filaVacia()]); setLineasTocadas(false)
  }

  const crear = useMutation({
    mutationFn: () => api.accCrearDocumento({
      no_cia: selectedCompany,
      punto: selectedPoint,
      ...(modoEdicion ? { no_docu: editNoDocu } : {}),
      no_caja: noCaja,
      no_bene: beneficiario!.no_bene,
      tipo_gasto: tipoGasto,
      fecha,
      valor: valorNum,
      impuesto: Number(impuesto || 0),
      ncf: ncf.trim() || undefined,
      rnc: rnc.trim() || undefined,
      detalle: detalle.trim() || undefined,
      no_formulario: noFormulario.trim() || undefined,
      forma_pago: formaPago ? Number(formaPago) : undefined,
      tipo_gasto_dgii: tipoGastoDgii.trim() || undefined,
      fecha_vence_ncf: fechaVenceNcf || undefined,
      cuenta: cajaSel?.cuenta,
      // Movimiento contable (TACC_DCDOCU): cada fila de la grilla se manda
      // tal cual el operador la dejó -- débito o crédito por línea, igual
      // que en CxP — Entrada de Documentos.
      lineas: lineas
        .filter((l) => l.cuenta && (Number(l.debito || 0) > 0 || Number(l.credito || 0) > 0))
        .map((l) => ({
          cuenta: l.cuenta,
          centro_costo: l.centroCosto || '0000000000',
          monto: Number(l.debito || 0) > 0 ? Number(l.debito) : Number(l.credito),
          tipo_movi: Number(l.debito || 0) > 0 ? 'D' : 'C',
        })),
      moneda: cajaSel?.moneda || 'DOP',
    }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['acc-documentos'] })
      qc.invalidateQueries({ queryKey: ['acc-rep-resumen'] })
      if (modoEdicion) {
        toast.success(`Egreso ACC-${res.no_docu} actualizado`)
        navigate({ to: '/acc/documentos' })
        return
      }
      toast.success(`Egreso ACC-${res.no_docu} creado por RD$ ${fmt(total)}`)
      reset()
    },
    onError: (e: any) => toast.error(e?.detail?.error || (modoEdicion ? 'No se pudo actualizar el egreso' : 'No se pudo crear el egreso')),
  })

  const puedeGuardar = !!noCaja && !!tipoGasto && !!beneficiario && !!fecha
    && valorNum > 0 && distribucionCuadra
    && (!ncfRequiereDgii || (!!formaPago && !!tipoGastoDgii.trim() && !!fechaVenceNcf))

  const formRef = useEnterAdvancesFocus<HTMLDivElement>()

  return (
    <div className="space-y-4" ref={formRef}>
      <div>
        <h3 className="text-base font-semibold">
          {modoEdicion ? `Editar Egreso ACC-${editNoDocu}` : 'Nuevo Egreso de Caja Chica'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {modoEdicion
            ? 'Corrige el egreso sin generar uno nuevo -- se guarda en el mismo número de documento, no se salta la secuencia.'
            : 'Registra un pago de caja chica con beneficiario, tipo de gasto y comprobante NCF.'}
          {' '}Equivale a <i>Facc201 — Egresos de Caja Chica</i>. Tabla base: <code>TACC_DOCUMENTO</code> + <code>TACC_DCDOCU</code>.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wallet className="h-4 w-4" /> Datos del egreso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Caja chica *</Label>
              <Select value={noCaja} onValueChange={setNoCaja}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>
                  {(cajasQ.data || []).filter((c: any) => c.activa === 'S').map((c: any) => (
                    <SelectItem key={c.no_caja} value={c.no_caja}>
                      {c.no_caja} — {c.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de gasto *</Label>
              <Select value={tipoGasto} onValueChange={setTipoGasto}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>
                  {(gastosQ.data || []).filter((g: any) => (g.activo ?? 'S') === 'S').map((g: any) => (
                    <SelectItem key={g.tipo_gasto} value={g.tipo_gasto}>
                      {g.tipo_gasto} — {g.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha *</Label>
              <Input type="date" className="h-9" value={fecha}
                     onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>

          {cajaSel && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm flex flex-wrap gap-x-6 gap-y-1">
              <span><span className="text-muted-foreground">Caja: </span>
                <span className="font-medium">{cajaSel.descripcion}</span></span>
              <span><span className="text-muted-foreground">Cuenta: </span>
                <span className="font-mono">{cajaSel.cuenta}</span></span>
              <span><span className="text-muted-foreground">Tope: </span>
                <span className="tabular-nums">RD$ {fmt(cajaSel.monto)}</span></span>
            </div>
          )}

          <BeneficiarioPicker value={beneficiario} onChange={setBeneficiario} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Valor (RD$) *</Label>
              <Input type="number" min="0.01" step="0.01"
                     className="h-9 text-right tabular-nums"
                     value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center justify-between">
                <span>ITBIS ({porcItbis}%)</span>
                <button type="button" onClick={() => setEditandoItbis(!editandoItbis)}
                        className="text-[10px] text-emerald-700 hover:underline">
                  {editandoItbis ? 'auto' : 'editar'}
                </button>
              </Label>
              <Input type="number" min="0" step="0.01"
                     className="h-9 text-right tabular-nums"
                     placeholder="auto"
                     value={impuesto} onChange={(e) => { setEditandoItbis(true); setImpuesto(e.target.value) }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Total</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-right text-sm tabular-nums">
                RD$ {fmt(total)}
              </div>
            </div>
          </div>

          <MovimientoContableGrid
            lineas={lineas}
            onChange={(v) => { setLineasTocadas(true); setLineas(v) }}
            titulo="Movimiento Contable (Distribución del egreso)"
          />
          {impuestoNum > 0 && !cuentaItbisQ.data?.cuenta && (
            <p className="text-xs text-muted-foreground">Buscando cuenta de ITBIS deducible…</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">NCF (B01–B15)</Label>
              <Input value={ncf} onChange={(e) => setNcf(e.target.value.toUpperCase())}
                     placeholder="Ej. B0100001234" className="h-9 font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">RNC / Cédula</Label>
              <Input value={rnc} onChange={(e) => setRnc(e.target.value)}
                     placeholder="Sin guiones" className="h-9 font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">No. Formulario</Label>
              <Input value={noFormulario} onChange={(e) => setNoFormulario(e.target.value)}
                     placeholder="No. de comprobante preimpreso" className="h-9 font-mono" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Forma de Pago</Label>
              <Select value={formaPago} onValueChange={setFormaPago}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>
                  {(formasPagoQ.data || []).map((f) => (
                    <SelectItem key={f.forma_pago} value={String(f.forma_pago)}>
                      {f.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Tipo Gasto DGII{ncfRequiereDgii ? ' *' : ''}
              </Label>
              <Select value={tipoGastoDgii} onValueChange={setTipoGastoDgii}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>
                  {(tiposGastoDgiiQ.data || []).map((t) => (
                    <SelectItem key={t.tipo_gasto} value={t.tipo_gasto}>
                      {t.tipo_gasto} — {t.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Vence NCF{ncfRequiereDgii ? ' *' : ''}
              </Label>
              <Input type="date" className="h-9" value={fechaVenceNcf}
                     onChange={(e) => setFechaVenceNcf(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Detalle / Concepto</Label>
            <Input value={detalle} onChange={(e) => setDetalle(e.target.value)}
                   placeholder="Ej. Compra de papelería 03/2026" className="h-9" />
          </div>

          <div className="flex items-center justify-end gap-3 border-t pt-3">
            <Button type="button" variant="outline"
                    onClick={() => modoEdicion ? navigate({ to: '/acc/documentos' }) : reset()}
                    disabled={crear.isPending}>
              {modoEdicion ? 'Cancelar' : 'Limpiar'}
            </Button>
            <Button type="button" onClick={() => crear.mutate()}
                    disabled={!puedeGuardar || crear.isPending}>
              <Save className="h-4 w-4 mr-1" />
              {crear.isPending ? 'Guardando…' : modoEdicion ? 'Guardar cambios' : 'Registrar egreso'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
