// SDN — Cierre de Nómina (equivale a Fsdn210 + Fsdn214/216 combinados).
// Antes no existía ninguna pantalla para esto: la nómina se calculaba
// (Fsdn203 / SdnCalcular) pero no había forma de generar el asiento
// contable ni de avanzar al siguiente período desde una sola vista.
// Resuelve TREP_PROBLEMA f5a80e18 (SDN: CIERRE NOMINA).
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Lock, Printer, ShieldCheck, TriangleAlert } from 'lucide-react'

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (s: any) => (s ? String(s).slice(0, 10) : '')

type Nomina = {
  no_cia: string; punto: string; nomina: string; descripcion: string
  forma_pago: string; fecha_inicial?: string; fecha_final?: string
  mes_proceso: number; ano_proceso: number; periodo?: number
  calculo_nomina: string; estado: string; cuenta_contable: string
}

export function SdnCierre() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const [nominaSel, setNominaSel] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [resultado, setResultado] = useState<any | null>(null)

  const nominasQ = useQuery({
    queryKey: ['sdn-nominas', selectedCompany, selectedPoint],
    queryFn: () => api.sdnListNominas({
      no_cia: selectedCompany, punto: selectedPoint, estado: 'A', limit: 200,
    }),
  })
  const lista: Nomina[] = (nominasQ.data || []).filter((n: Nomina) => n.estado === 'A')
  const nomina = lista.find((n) => n.nomina === nominaSel)

  const cierreQ = useQuery({
    queryKey: ['sdn-resumen-cierre', selectedCompany, selectedPoint, nominaSel],
    queryFn: () => api.sdnResumenCierre({
      no_cia: selectedCompany, punto: selectedPoint, nomina: nominaSel,
    }),
    enabled: !!nominaSel,
  })

  const bloqueos: string[] = cierreQ.data?.bloqueos || []
  const asiento = cierreQ.data?.asiento
  const siguiente = cierreQ.data?.siguiente_periodo
  const puedeConfirmar = bloqueos.length === 0 && asiento && asiento.faltantes.length === 0
    && asiento.detalle.length > 0 && asiento.cuadra

  const cerrar = useMutation({
    mutationFn: () => api.sdnCerrarNomina({
      no_cia: selectedCompany, punto: selectedPoint, nomina: nominaSel,
    }),
    onSuccess: (res: any) => {
      toast.success(
        `Período ${fmtDate(res.periodo_cerrado.fecha_inicial)} → ${fmtDate(res.periodo_cerrado.fecha_final)} cerrado. `
        + `Nómina lista para calcular el período ${fmtDate(res.nomina.fecha_inicial)} → ${fmtDate(res.nomina.fecha_final)}.`
      )
      setConfirmando(false)
      setResultado(res)
      qc.invalidateQueries({ queryKey: ['sdn-nominas'] })
      qc.invalidateQueries({ queryKey: ['sdn-resumen-cierre'] })
      qc.invalidateQueries({ queryKey: ['sdn-volante-pre'] })
      qc.invalidateQueries({ queryKey: ['sdn-rep-nominas'] })
    },
    onError: (e: any) => {
      setConfirmando(false)
      toast.error(e?.detail?.error || e?.message || 'No se pudo cerrar el período')
    },
  })

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <h3 className="text-base font-semibold">Cierre de Nómina</h3>
        <p className="text-sm text-muted-foreground">
          Genera el asiento contable del período ya calculado y avanza la nómina
          al siguiente período (quincena 1–15 / 16–fin de mes), en un solo paso.
          Equivale a <i>Fsdn210</i> (asiento) + avance de período. Requiere que el
          período actual esté calculado (pantalla <i>Calcular Nómina</i>).
        </p>
      </div>

      <Card className="print:hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Selección de nómina</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={nominaSel} onValueChange={(v) => { setNominaSel(v); setResultado(null) }}>
            <SelectTrigger className="h-9 md:w-96"><SelectValue placeholder="Selecciona una nómina…" /></SelectTrigger>
            <SelectContent>
              {lista.map((n) => (
                <SelectItem key={n.nomina} value={n.nomina}>
                  {n.nomina} — {n.descripcion} · {String(n.mes_proceso).padStart(2, '0')}/{n.ano_proceso}
                  {n.periodo ? ` · #${n.periodo}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {nomina && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm flex flex-wrap gap-x-6 gap-y-1">
              <span><span className="text-muted-foreground">Período actual: </span>
                {fmtDate(nomina.fecha_inicial)} → {fmtDate(nomina.fecha_final)}
                {nomina.periodo ? ` (#${nomina.periodo})` : ''}
              </span>
              <span><span className="text-muted-foreground">Estado: </span>
                {nomina.calculo_nomina === 'S'
                  ? <Badge variant="outline">Calculada</Badge>
                  : <Badge variant="secondary">Sin calcular</Badge>}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {nominaSel && bloqueos.length > 0 && (
        <Card className="border-amber-300 print:hidden">
          <CardContent className="pt-4 space-y-2">
            {bloqueos.map((b) => (
              <div key={b} className="flex items-start gap-2 text-sm text-amber-900">
                <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" /> {b}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {nominaSel && asiento && bloqueos.length === 0 && !resultado && (
        <>
          <Card className="print:hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                Asiento contable a generar
                {asiento.cuadra
                  ? <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3" /> Cuadra</Badge>
                  : <Badge variant="destructive">No cuadra</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {asiento.faltantes.length > 0 && (
                <div className="rounded border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive space-y-1">
                  {asiento.faltantes.map((f: string) => <div key={f}>{f}</div>)}
                </div>
              )}
              <div className="overflow-x-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cuenta</TableHead>
                      <TableHead className="text-right">Débito</TableHead>
                      <TableHead className="text-right">Crédito</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {asiento.resumen_cuentas.map((r: any) => (
                      <TableRow key={r.cuenta}>
                        <TableCell className="font-mono">{r.cuenta}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {r.debito ? fmt(r.debito) : ''}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {r.credito ? fmt(r.credito) : ''}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{fmt(asiento.total_debito)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{fmt(asiento.total_credito)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              {asiento.monto_regalia > 0 && (
                <p className="text-xs text-muted-foreground">
                  Incluye provisión de regalía (1/12 del sueldo del período): RD$ {fmt(asiento.monto_regalia)}.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Nota: si hay aportes patronales de AFP/ARS pendientes de aplicar en este
                período, no aparecen aquí — deben registrarse antes desde Deducción Masiva.
              </p>
            </CardContent>
          </Card>

          {siguiente && (
            <Card className="print:hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Siguiente período (al cerrar)</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="font-mono">{siguiente.fecha_inicial}</span>
                  {' → '}
                  <span className="font-mono">{siguiente.fecha_final}</span>
                  <span className="text-muted-foreground"> · período #{siguiente.periodo}</span>
                </div>
                <Button onClick={() => setConfirmando(true)} disabled={!puedeConfirmar || cerrar.isPending}>
                  <Lock className="h-4 w-4 mr-1" /> Generar Asiento y Cerrar Período
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {resultado && (
        <Card>
          <CardHeader className="pb-2 print:hidden">
            <CardTitle className="text-sm flex items-center justify-between">
              Cierre completado
              <Button size="sm" variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-1" /> Imprimir
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="hidden print:block text-center mb-4">
              <h2 className="text-lg font-semibold">Cierre de Nómina</h2>
              <p className="text-sm">{nomina?.descripcion} — Cía {selectedCompany} / Punto {selectedPoint}</p>
            </div>
            <div className="rounded border bg-muted/40 px-3 py-2 text-sm">
              Período cerrado:{' '}
              <b>{fmtDate(resultado.periodo_cerrado.fecha_inicial)} → {fmtDate(resultado.periodo_cerrado.fecha_final)}</b>
              {' '}(#{resultado.periodo_cerrado.periodo})
            </div>
            <div className="overflow-x-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cuenta</TableHead>
                    <TableHead className="text-right">Débito</TableHead>
                    <TableHead className="text-right">Crédito</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultado.asiento.resumen_cuentas.map((r: any) => (
                    <TableRow key={r.cuenta}>
                      <TableCell className="font-mono">{r.cuenta}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {r.debito ? fmt(r.debito) : ''}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {r.credito ? fmt(r.credito) : ''}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{fmt(resultado.asiento.total_debito)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{fmt(resultado.asiento.total_credito)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div className="text-sm text-muted-foreground print:hidden">
              La nómina quedó lista para calcular el período{' '}
              <b>{fmtDate(resultado.nomina.fecha_inicial)} → {fmtDate(resultado.nomina.fecha_final)}</b>{' '}
              desde la pantalla <i>Calcular Nómina</i>.
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmando} onOpenChange={(v) => { if (!v) setConfirmando(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="h-4 w-4" /> Confirmar cierre de período</DialogTitle>
          </DialogHeader>
          {nomina && asiento && siguiente && (
            <div className="space-y-3 text-sm">
              <div className="rounded border bg-muted/40 p-3">
                Se generará el asiento contable del período{' '}
                <b>{fmtDate(nomina.fecha_inicial)} → {fmtDate(nomina.fecha_final)}</b>{' '}
                (total RD$ {fmt(asiento.total_debito)}) y la nómina quedará lista para
                calcular el período <b>{siguiente.fecha_inicial} → {siguiente.fecha_final}</b>.
                Esta acción no se puede deshacer desde la pantalla.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmando(false)} disabled={cerrar.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => cerrar.mutate()} disabled={cerrar.isPending}>
              <Lock className="h-4 w-4 mr-1" />
              {cerrar.isPending ? 'Cerrando…' : 'Confirmar Cierre'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
