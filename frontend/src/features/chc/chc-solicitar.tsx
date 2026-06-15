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
import { ReceiptText, Search, Save } from 'lucide-react'

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const monedaSimbolo = (m?: string) => (m === 'U' || m === 'D' || m === 'US' ? 'US$' : 'RD$')

type Proveedor = {
  no_proveedor: string
  nombre: string
  rnc?: string
  direccion?: string
}

function ProveedorPicker({
  value,
  onChange,
}: {
  value: Proveedor | null
  onChange: (p: Proveedor | null) => void
}) {
  const [codigo, setCodigo] = useState(value?.no_proveedor ?? '')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Proveedor[]>([])
  const [searching, setSearching] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setCodigo(value?.no_proveedor ?? '') }, [value?.no_proveedor])

  const cargarPorCodigo = async (cod: string) => {
    const trimmed = cod.trim()
    if (!trimmed) { onChange(null); return }
    try {
      const p = await api.cxpGetProveedor(trimmed)
      if (p && p.no_proveedor) onChange(p)
      else { toast.error(`Proveedor ${trimmed} no encontrado`); onChange(null) }
    } catch {
      toast.error(`Proveedor ${trimmed} no encontrado`)
      onChange(null)
    }
  }

  const buscar = async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const rows = await api.cxpListProveedores({ search: q, activo: 'S' })
      setResults(rows)
    } catch { setResults([]) } finally { setSearching(false) }
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs">Proveedor (opcional)</Label>
      <div className="flex items-center gap-2">
        <Input
          value={codigo}
          onChange={(e) => { setCodigo(e.target.value); if (value) onChange(null) }}
          onBlur={(e) => cargarPorCodigo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); cargarPorCodigo(codigo) } }}
          placeholder="Código"
          className="h-9 w-32 font-mono"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => { setOpen(true); setTimeout(() => searchRef.current?.focus(), 50) }}
        >
          <Search className="h-4 w-4" />
        </Button>
        {value ? (
          <div className="flex flex-1 flex-wrap items-center gap-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm">
            <div className="min-w-0">
              <div className="text-[10px] uppercase text-emerald-600">Nombre</div>
              <div className="truncate font-medium text-emerald-900">{value.nombre}</div>
            </div>
            {value.rnc && (
              <div>
                <div className="text-[10px] uppercase text-emerald-600">RNC</div>
                <div className="font-mono text-emerald-800">{value.rnc}</div>
              </div>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto text-muted-foreground hover:text-destructive"
              onClick={() => { onChange(null); setCodigo('') }}
            >
              Quitar
            </Button>
          </div>
        ) : (
          <div className="flex h-9 flex-1 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">
            Vacío para cheques a personas. Use lupa o código para proveedor CxP.
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[70vh] w-[60vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>Buscar Proveedor</DialogTitle>
          </DialogHeader>
          <div className="shrink-0 border-b bg-background px-6 py-3">
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => { setSearch(e.target.value); buscar(e.target.value) }}
              placeholder="Buscar por nombre, código o RNC…"
              className="h-11 text-base"
              autoFocus
            />
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="w-32">Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="w-36">RNC</TableHead>
                  <TableHead className="w-24 text-center">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                      {searching ? 'Buscando…' : 'Escribe al menos 2 caracteres'}
                    </TableCell>
                  </TableRow>
                ) : (
                  results.map((p) => (
                    <TableRow key={p.no_proveedor} className="cursor-pointer hover:bg-muted/40"
                              onClick={() => { onChange(p); setOpen(false); setSearch(''); setResults([]) }}>
                      <TableCell className="font-mono text-xs">{p.no_proveedor}</TableCell>
                      <TableCell>{p.nombre}</TableCell>
                      <TableCell className="font-mono text-xs">{p.rnc || ''}</TableCell>
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

export function ChcSolicitar() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()

  const cuentasQ = useQuery({
    queryKey: ['chc-cuentas-solicitar', selectedCompany, selectedPoint],
    queryFn: () => api.chcListCuentas({ no_cia: selectedCompany, punto: selectedPoint, activa: 'S' }),
  })
  const tdocuQ = useQuery({
    queryKey: ['chc-tdocu'],
    queryFn: () => api.chcListTiposDocu(),
  })

  const [cuentaBanco, setCuentaBanco] = useState('')
  const [tipoDocu, setTipoDocu] = useState('SO')
  const [beneficiario, setBeneficiario] = useState('')
  const [valor, setValor] = useState('')
  const [fechaCheque, setFechaCheque] = useState(() => new Date().toISOString().slice(0, 10))
  const [detalle, setDetalle] = useState('')
  const [proveedor, setProveedor] = useState<Proveedor | null>(null)

  const cuentaSel = (cuentasQ.data || []).find((c: any) => c.cuenta_banco === cuentaBanco)
  const tdocuSel = (tdocuQ.data || []).find((t: any) => t.tipo_docu === tipoDocu)

  const saldoQ = useQuery({
    queryKey: ['chc-saldo-solicitar', selectedCompany, selectedPoint, cuentaBanco],
    queryFn: () => api.chcGetSaldoCuenta(selectedCompany, selectedPoint, cuentaBanco),
    enabled: !!cuentaBanco,
  })

  const reset = () => {
    setBeneficiario(''); setValor(''); setDetalle(''); setProveedor(null)
    setFechaCheque(new Date().toISOString().slice(0, 10))
  }

  const solicitar = useMutation({
    mutationFn: () => api.chcSolicitarCheque({
      no_cia: selectedCompany,
      punto: selectedPoint,
      cuenta_banco: cuentaBanco,
      tipo_docu: tipoDocu,
      beneficiario: beneficiario.trim().toUpperCase(),
      valor_original: Number(valor),
      fecha_cheque: fechaCheque || undefined,
      no_proveedor: proveedor?.no_proveedor || undefined,
      detalle1: detalle.trim() || undefined,
    }),
    onSuccess: (res: any) => {
      toast.success(`${res.tipo_docu}-${res.no_docu} creado por ${monedaSimbolo(res.moneda_cuenta)} ${fmt(res.valor_original)}`)
      qc.invalidateQueries({ queryKey: ['chc-cheques'] })
      qc.invalidateQueries({ queryKey: ['chc-cuentas'] })
      qc.invalidateQueries({ queryKey: ['chc-saldo-solicitar'] })
      reset()
    },
    onError: (e: any) => toast.error(e?.detail?.error || e?.message || 'No se pudo crear el cheque'),
  })

  const puedeGuardar = !!cuentaBanco && !!tipoDocu && !!beneficiario.trim()
    && Number(valor) > 0 && !!fechaCheque

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Solicitar Cheque</h3>
        <p className="text-sm text-muted-foreground">
          Crea una solicitud de cheque, depósito u otro movimiento bancario.
          Equivale a <i>Fchc201 — Solicitud de Cheque</i> del sistema legado. Tabla base: <code>TCHC_CHEQUE</code>.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ReceiptText className="h-4 w-4" /> Datos de la solicitud
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Cuenta bancaria *</Label>
              <Select value={cuentaBanco} onValueChange={setCuentaBanco}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>
                  {(cuentasQ.data || []).map((c: any) => (
                    <SelectItem key={c.cuenta_banco} value={c.cuenta_banco}>
                      {c.cuenta_banco} — {monedaSimbolo(c.moneda)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de documento *</Label>
              <Select value={tipoDocu} onValueChange={setTipoDocu}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(tdocuQ.data || []).filter((t: any) => (t.activo ?? 'S') === 'S').map((t: any) => (
                    <SelectItem key={t.tipo_docu} value={t.tipo_docu}>
                      {t.tipo_docu} — {t.descri}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha del cheque *</Label>
              <Input type="date" className="h-9" value={fechaCheque}
                     onChange={(e) => setFechaCheque(e.target.value)} />
            </div>
          </div>

          {cuentaSel && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm flex flex-wrap gap-x-6 gap-y-1">
              <span><span className="text-muted-foreground">Saldo aproximado: </span>
                <span className="tabular-nums font-medium">
                  {monedaSimbolo(cuentaSel.moneda)} {fmt(saldoQ.data?.saldo_aprox)}
                </span>
              </span>
              <span><span className="text-muted-foreground">Cheques por entregar: </span>
                <span className="tabular-nums">{fmt(cuentaSel.che_por_entregar)}</span>
              </span>
              <span><span className="text-muted-foreground">Próx. cheque: </span>
                <span className="font-mono">{cuentaSel.prox_cheque || '—'}</span>
              </span>
              {tdocuSel && (
                <span><span className="text-muted-foreground">Movimiento: </span>
                  {tdocuSel.tipo_movi === 'D' ? 'Débito (entra)' : 'Crédito (sale)'}
                  {tdocuSel.cuenta ? ` · cta ${tdocuSel.cuenta}` : ''}
                </span>
              )}
            </div>
          )}

          <ProveedorPicker value={proveedor} onChange={(p) => {
            setProveedor(p)
            if (p && !beneficiario.trim()) setBeneficiario(p.nombre)
          }} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Beneficiario *</Label>
              <Input value={beneficiario}
                     onChange={(e) => setBeneficiario(e.target.value)}
                     placeholder="Nombre del beneficiario"
                     className="h-9 uppercase" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valor ({monedaSimbolo(cuentaSel?.moneda)}) *</Label>
              <Input type="number" min="0.01" step="0.01" className="h-9 text-right tabular-nums"
                     value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Detalle / Concepto</Label>
            <Input value={detalle} onChange={(e) => setDetalle(e.target.value)}
                   placeholder="Ej. Pago energía marzo 2026" className="h-9" />
          </div>

          <div className="flex items-center justify-end gap-3 border-t pt-3">
            <Button type="button" variant="outline" onClick={reset} disabled={solicitar.isPending}>
              Limpiar
            </Button>
            <Button type="button" onClick={() => solicitar.mutate()}
                    disabled={!puedeGuardar || solicitar.isPending}>
              <Save className="h-4 w-4 mr-1" />
              {solicitar.isPending ? 'Guardando…' : 'Crear solicitud'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
