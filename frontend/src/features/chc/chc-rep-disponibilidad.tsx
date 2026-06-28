import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { FileText } from 'lucide-react'

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function ChcRepDisponibilidad() {
  const { selectedCompany, selectedPoint } = useCompany()
  const q = useQuery<any[]>({
    queryKey: ['chc-rep-disponibilidad', selectedCompany, selectedPoint],
    queryFn: () => api.chcRepDisponibilidad({ no_cia: selectedCompany, punto: selectedPoint }),
  })
  const rows = q.data || []

  const dop = rows.filter((r) => r.moneda === 'P')
  const usd = rows.filter((r) => r.moneda === 'D')
  const totDispDop = dop.reduce((s, r) => s + Number(r.disponible_neto || 0), 0)
  const totDispUsd = usd.reduce((s, r) => s + Number(r.disponible_neto || 0), 0)
  const totChePeDop = dop.reduce((s, r) => s + Number(r.che_por_entregar || 0), 0)

  const openPdf = () => {
    const qs = new URLSearchParams({ no_cia: selectedCompany, punto: selectedPoint }).toString()
    window.open(`/print/chc-rep-disponibilidad/current?${qs}`, '_blank')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">Disponibilidad Bancaria (Rchc505)</h3>
          <p className="text-sm text-muted-foreground">
            Saldo disponible neto = saldo aproximado − cheques solicitados pero aún por entregar. Útil para autorizar nuevos pagos sin sobregirar.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={openPdf} disabled={rows.length === 0}>
          <FileText className="h-4 w-4 mr-1" /> Imprimir PDF
        </Button>
      </div>

      {q.isLoading ? <Skeleton className="h-32 w-full" /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Cuentas DOP</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{dop.length}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Disponible RD$</CardTitle></CardHeader>
              <CardContent className={`text-xl font-semibold tabular-nums ${totDispDop < 0 ? 'text-destructive' : 'text-emerald-600'}`}>{fmt(totDispDop)}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Cheques por entregar RD$</CardTitle></CardHeader>
              <CardContent className="text-xl font-semibold tabular-nums">{fmt(totChePeDop)}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Disponible US$</CardTitle></CardHeader>
              <CardContent className={`text-xl font-semibold tabular-nums ${totDispUsd < 0 ? 'text-destructive' : 'text-emerald-600'}`}>{fmt(totDispUsd)}</CardContent></Card>
          </div>

          <div className="rounded border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Saldo Aprox.</TableHead>
                  <TableHead className="text-right">Cheques por Entregar</TableHead>
                  <TableHead className="text-right">Disponible Neto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.cuenta_banco}>
                    <TableCell className="font-mono">{c.cuenta_banco}</TableCell>
                    <TableCell><Badge variant="outline">{c.moneda === 'P' ? 'DOP' : 'USD'}</Badge></TableCell>
                    <TableCell className="text-xs">{String(c.mes_proceso).padStart(2, '0')}/{c.ano_proceso}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(c.saldo_aprox)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(c.che_por_entregar)}</TableCell>
                    <TableCell className={`text-right tabular-nums font-semibold ${Number(c.disponible_neto) < 0 ? 'text-destructive' : ''}`}>
                      {fmt(c.disponible_neto)}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      Sin cuentas bancarias activas para la empresa/punto.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
