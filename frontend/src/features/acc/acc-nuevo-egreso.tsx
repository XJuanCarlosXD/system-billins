import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
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
        <DialogContent className="flex h-[70vh] w-[60vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
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

export function AccNuevoEgreso() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()

  const cajasQ = useQuery({
    queryKey: ['acc-cajas-egreso', selectedCompany, selectedPoint],
    queryFn: () => api.accListCajas(selectedCompany, selectedPoint),
  })
  const gastosQ = useQuery({
    queryKey: ['acc-tipos-gasto'],
    queryFn: () => api.accListTiposGasto(),
  })

  const [noCaja, setNoCaja] = useState('')
  const [tipoGasto, setTipoGasto] = useState('')
  const [beneficiario, setBeneficiario] = useState<Beneficiario | null>(null)
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [valor, setValor] = useState('')
  const [impuesto, setImpuesto] = useState('0')
  const [ncf, setNcf] = useState('')
  const [rnc, setRnc] = useState('')
  const [detalle, setDetalle] = useState('')

  const cajaSel = (cajasQ.data || []).find((c: any) => c.no_caja === noCaja && c.activa === 'S')
  const gastoSel = (gastosQ.data || []).find((g: any) => g.tipo_gasto === tipoGasto)

  // Si selecciona beneficiario con RNC y aún no llenó RNC manual, autocompletar.
  useEffect(() => {
    if (beneficiario?.rnc && !rnc) setRnc(beneficiario.rnc)
  }, [beneficiario?.rnc])

  const reset = () => {
    setBeneficiario(null); setTipoGasto(''); setValor('');
    setImpuesto('0'); setNcf(''); setRnc(''); setDetalle('')
    setFecha(new Date().toISOString().slice(0, 10))
  }

  const crear = useMutation({
    mutationFn: () => api.accCrearDocumento({
      no_cia: selectedCompany,
      punto: selectedPoint,
      no_caja: noCaja,
      no_bene: beneficiario!.no_bene,
      tipo_gasto: tipoGasto,
      fecha,
      valor: Number(valor),
      impuesto: Number(impuesto || 0),
      ncf: ncf.trim() || undefined,
      rnc: rnc.trim() || undefined,
      detalle: detalle.trim() || undefined,
      cuenta: cajaSel?.cuenta,
      cuenta_gasto: gastoSel?.cuenta,
      centro_costo: gastoSel?.centro_costo || '0000000000',
      moneda: cajaSel?.moneda || 'DOP',
      forma_pago: 1,
    }),
    onSuccess: (res: any) => {
      toast.success(`Egreso ACC-${res.no_docu} creado por RD$ ${fmt(valor)}`)
      qc.invalidateQueries({ queryKey: ['acc-documentos'] })
      qc.invalidateQueries({ queryKey: ['acc-rep-resumen'] })
      reset()
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo crear el egreso'),
  })

  const valorNum = Number(valor || 0)
  const impuestoNum = Number(impuesto || 0)
  const total = valorNum + impuestoNum
  const puedeGuardar = !!noCaja && !!tipoGasto && !!beneficiario && !!fecha && valorNum > 0

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Nuevo Egreso de Caja Chica</h3>
        <p className="text-sm text-muted-foreground">
          Registra un pago de caja chica con beneficiario, tipo de gasto y comprobante NCF.
          Equivale a <i>Facc201 — Egresos de Caja Chica</i>. Tabla base: <code>TACC_DOCUMENTO</code> + <code>TACC_DCDOCU</code>.
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
              {gastoSel && (
                <span><span className="text-muted-foreground">Cuenta gasto: </span>
                  <span className="font-mono">{gastoSel.cuenta}</span></span>
              )}
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
              <Label className="text-xs">ITBIS / Impuesto</Label>
              <Input type="number" min="0" step="0.01"
                     className="h-9 text-right tabular-nums"
                     value={impuesto} onChange={(e) => setImpuesto(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Total</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-right text-sm tabular-nums">
                RD$ {fmt(total)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Detalle / Concepto</Label>
            <Input value={detalle} onChange={(e) => setDetalle(e.target.value)}
                   placeholder="Ej. Compra de papelería 03/2026" className="h-9" />
          </div>

          <div className="flex items-center justify-end gap-3 border-t pt-3">
            <Button type="button" variant="outline" onClick={reset} disabled={crear.isPending}>
              Limpiar
            </Button>
            <Button type="button" onClick={() => crear.mutate()}
                    disabled={!puedeGuardar || crear.isPending}>
              <Save className="h-4 w-4 mr-1" />
              {crear.isPending ? 'Guardando…' : 'Registrar egreso'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
