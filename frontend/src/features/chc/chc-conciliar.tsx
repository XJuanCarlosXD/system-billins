import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Calendar, CheckSquare, LockKeyhole, Search } from 'lucide-react'

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (s: any) => (s ? String(s).slice(0, 10) : '')

export function ChcConciliar() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const [cuentaBanco, setCuentaBanco] = useState('')
  const [pendingOnly, setPendingOnly] = useState(true)
  const today = new Date()
  const [desde, setDesde] = useState(new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 10))
  const [hasta, setHasta] = useState(today.toISOString().slice(0, 10))
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [cierreOpen, setCierreOpen] = useState(false)
  const [cierreMes, setCierreMes] = useState(String(today.getMonth() + 1).padStart(2, '0'))
  const [cierreAno, setCierreAno] = useState(String(today.getFullYear()))

  const cuentasQ = useQuery({
    queryKey: ['chc-cuentas-conciliar', selectedCompany, selectedPoint],
    queryFn: () => api.chcListCuentas({ no_cia: selectedCompany, punto: selectedPoint, activa: 'S' }),
  })

  const listQ = useQuery({
    queryKey: ['chc-conciliar', selectedCompany, selectedPoint, cuentaBanco, pendingOnly, desde, hasta],
    queryFn: () => api.chcListCheques({
      no_cia: selectedCompany, punto: selectedPoint,
      cuenta_banco: cuentaBanco || undefined,
      conciliado: pendingOnly ? 'N' : undefined,
      fecha_desde: desde, fecha_hasta: hasta,
      limit: 500,
    }),
    enabled: !!cuentaBanco,
  })

  const rows: any[] = useMemo(() => {
    const data = listQ.data || []
    const s = search.trim().toLowerCase()
    if (!s) return data
    return data.filter((c: any) =>
      `${c.tipo_docu}${c.no_docu}${c.beneficiario || ''}${c.nombre_proveedor || ''}`.toLowerCase().includes(s),
    )
  }, [listQ.data, search])

  const toggle = (key: string) => {
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(key)) n.delete(key); else n.add(key)
      return n
    })
  }
  const toggleAll = () => {
    if (picked.size === rows.length) setPicked(new Set())
    else setPicked(new Set(rows.map((r) => `${r.tipo_docu}-${r.no_docu}`)))
  }

  const conciliarBulk = useMutation({
    mutationFn: () => {
      const items = Array.from(picked).map((k) => {
        const [tipo_docu, no_docu] = k.split('-')
        return { tipo_docu, no_docu }
      })
      return api.chcConciliarBulk({ no_cia: selectedCompany, punto: selectedPoint, items })
    },
    onSuccess: (r: any) => {
      toast.success(`${r.afectados} movimientos conciliados`)
      setPicked(new Set())
      qc.invalidateQueries({ queryKey: ['chc-conciliar'] })
      qc.invalidateQueries({ queryKey: ['chc-cheques'] })
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo conciliar'),
  })

  const cerrarMes = useMutation({
    mutationFn: () => api.chcCierreConciliacion({
      no_cia: selectedCompany, punto: selectedPoint,
      cuenta_banco: cuentaBanco,
      ano: Number(cierreAno), mes: Number(cierreMes),
    }),
    onSuccess: () => {
      toast.success(`Cierre ${cierreMes}/${cierreAno} registrado`)
      setCierreOpen(false)
      qc.invalidateQueries({ queryKey: ['chc-cierres'] })
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo cerrar el mes'),
  })

  const sumPicked = useMemo(() => {
    if (!listQ.data) return { d: 0, c: 0 }
    let d = 0, c = 0
    for (const r of listQ.data as any[]) {
      const k = `${r.tipo_docu}-${r.no_docu}`
      if (!picked.has(k)) continue
      const v = Number(r.valor_original || 0)
      if (r.tipo_movi === 'D') d += v
      else if (r.tipo_movi === 'C') c += v
    }
    return { d, c }
  }, [listQ.data, picked])

  const sumAll = useMemo(() => {
    let d = 0, c = 0
    for (const r of rows) {
      const v = Number(r.valor_original || 0)
      if (r.tipo_movi === 'D') d += v
      else if (r.tipo_movi === 'C') c += v
    }
    return { d, c }
  }, [rows])

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Conciliación Bancaria</h3>
        <p className="text-sm text-muted-foreground">
          Marca movimientos como conciliados contra el estado de cuenta. Una vez cuadrado, registra el cierre del mes para bloquear cambios.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Cuenta <span className="text-destructive">*</span></Label>
          <Select value={cuentaBanco} onValueChange={(v) => { setCuentaBanco(v); setPicked(new Set()) }}>
            <SelectTrigger className="w-64 h-9"><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
            <SelectContent>
              {(cuentasQ.data || []).map((c: any) => (
                <SelectItem key={c.cuenta_banco} value={c.cuenta_banco}>
                  {c.cuenta_banco} · {c.moneda === 'P' ? 'DOP' : 'USD'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Desde</Label>
          <Input type="date" className="h-9 w-40" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hasta</Label>
          <Input type="date" className="h-9 w-40" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div className="space-y-1 flex-1 min-w-64">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
                   placeholder="Documento o beneficiario" className="h-9 pl-8" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="pending-only" checked={pendingOnly} onCheckedChange={(v) => setPendingOnly(!!v)} />
          <Label htmlFor="pending-only" className="text-sm cursor-pointer">Solo pendientes</Label>
        </div>
      </div>

      {!cuentaBanco ? (
        <div className="rounded border p-6 text-center text-sm text-muted-foreground">
          Selecciona una cuenta para empezar.
        </div>
      ) : listQ.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">En pantalla</CardTitle></CardHeader>
              <CardContent className="text-xl font-semibold">{rows.length}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Débitos</CardTitle></CardHeader>
              <CardContent className="text-xl font-semibold tabular-nums">+ {fmt(sumAll.d)}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Créditos</CardTitle></CardHeader>
              <CardContent className="text-xl font-semibold tabular-nums">− {fmt(sumAll.c)}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Seleccionados</CardTitle></CardHeader>
              <CardContent className="text-xl font-semibold tabular-nums">{picked.size} <span className="text-xs text-muted-foreground">(+{fmt(sumPicked.d)} / −{fmt(sumPicked.c)})</span></CardContent></Card>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => conciliarBulk.mutate()}
                    disabled={picked.size === 0 || conciliarBulk.isPending}>
              <CheckSquare className="h-4 w-4 mr-1" />
              {conciliarBulk.isPending ? 'Marcando…' : `Marcar ${picked.size} conciliados`}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCierreOpen(true)}>
              <LockKeyhole className="h-4 w-4 mr-1" /> Cerrar mes…
            </Button>
            <div className="ml-auto text-xs text-muted-foreground">
              {pendingOnly ? 'Mostrando solo no conciliados' : 'Mostrando todos los movimientos del rango'}
            </div>
          </div>

          <div className="rounded border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={rows.length > 0 && picked.size === rows.length}
                              onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Doc.</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Beneficiario</TableHead>
                  <TableHead className="text-right">Débito</TableHead>
                  <TableHead className="text-right">Crédito</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any) => {
                  const key = `${r.tipo_docu}-${r.no_docu}`
                  const isPicked = picked.has(key)
                  const isAnul = r.st_nulo === 'N'
                  return (
                    <TableRow key={key} className={isAnul ? 'opacity-60' : ''}>
                      <TableCell>
                        <Checkbox checked={isPicked} disabled={isAnul || r.conciliado === 'S'}
                                  onCheckedChange={() => toggle(key)} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.tipo_docu}-{r.no_docu}</TableCell>
                      <TableCell className="text-xs">{fmtDate(r.fecha_cheque || r.fecha_solicitud)}</TableCell>
                      <TableCell className="truncate max-w-sm">{r.beneficiario || r.nombre_proveedor}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.tipo_movi === 'D' ? fmt(r.valor_original) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.tipo_movi === 'C' ? fmt(r.valor_original) : '—'}
                      </TableCell>
                      <TableCell>
                        {isAnul ? <Badge variant="destructive">Nulo</Badge>
                          : r.conciliado === 'S' ? <Badge variant="outline">Conciliado</Badge>
                          : <Badge variant="secondary">Pendiente</Badge>}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      Sin movimientos pendientes en el rango.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Dialog open={cierreOpen} onOpenChange={setCierreOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Cierre de conciliación
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              El cierre del mes registra una marca en <code>TCHC_CIERRE_CONCILIACION</code> y bloquea cambios sobre los movimientos de ese periodo en la cuenta <strong>{cuentaBanco}</strong>.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Mes <span className="text-destructive">*</span></Label>
                <Input value={cierreMes} onChange={(e) => setCierreMes(e.target.value)} placeholder="06" maxLength={2} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Año <span className="text-destructive">*</span></Label>
                <Input value={cierreAno} onChange={(e) => setCierreAno(e.target.value)} placeholder="2026" maxLength={4} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCierreOpen(false)} disabled={cerrarMes.isPending}>Cancelar</Button>
            <Button onClick={() => cerrarMes.mutate()}
                    disabled={!cuentaBanco || !cierreMes || !cierreAno || cerrarMes.isPending}>
              <LockKeyhole className="h-4 w-4 mr-1" />
              {cerrarMes.isPending ? 'Cerrando…' : 'Confirmar cierre'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
