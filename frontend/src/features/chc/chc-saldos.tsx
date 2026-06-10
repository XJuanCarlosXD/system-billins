import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })

export function ChcSaldos() {
  const { selectedCompany, selectedPoint } = useCompany()
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['chc-rep-bal-saldos', selectedCompany, selectedPoint], queryFn: () => api.chcRepBalance({ no_cia: selectedCompany, punto: selectedPoint }) })

  const dop = data.filter((r: any) => r.moneda === 'P')
  const usd = data.filter((r: any) => r.moneda === 'D')
  const totDop = dop.reduce((s: number, r: any) => s + Number(r.saldo_aprox || 0), 0)
  const totUsd = usd.reduce((s: number, r: any) => s + Number(r.saldo_aprox || 0), 0)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Saldos y Disponibilidad</h3>
        <p className="text-sm text-muted-foreground">Saldo calculado por cuenta (saldo_inicial + depósitos + créditos - cheques - débitos).</p>
      </div>
      {isLoading ? <Skeleton className="h-32 w-full" /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Cuentas DOP</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{dop.length}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saldo total RD$</CardTitle></CardHeader><CardContent className={`text-xl font-semibold tabular-nums ${totDop < 0 ? 'text-destructive' : ''}`}>{fmt(totDop)}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Cuentas USD</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{usd.length}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saldo total US$</CardTitle></CardHeader><CardContent className={`text-xl font-semibold tabular-nums ${totUsd < 0 ? 'text-destructive' : ''}`}>{fmt(totUsd)}</CardContent></Card>
          </div>
          <div className="rounded border overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Cuenta</TableHead><TableHead>Moneda</TableHead><TableHead>Período</TableHead>
                <TableHead className="text-right">Saldo Inicial</TableHead>
                <TableHead className="text-right">Cheques Mes</TableHead><TableHead className="text-right">Depósito Mes</TableHead>
                <TableHead className="text-right">D Mes</TableHead><TableHead className="text-right">C Mes</TableHead>
                <TableHead className="text-right">Saldo Aprox.</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.map((c: any) => (
                  <TableRow key={c.cuenta_banco}>
                    <TableCell className="font-mono">{c.cuenta_banco}</TableCell>
                    <TableCell><Badge variant="outline">{c.moneda === 'P' ? 'DOP' : 'USD'}</Badge></TableCell>
                    <TableCell className="text-xs">{String(c.mes_proceso).padStart(2, '0')}/{c.ano_proceso}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(c.saldo_inicial)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(c.che_mes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(c.deposito_mes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(c.deb_mes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(c.cre_mes)}</TableCell>
                    <TableCell className={`text-right tabular-nums font-semibold ${Number(c.saldo_aprox) < 0 ? 'text-destructive' : ''}`}>{fmt(c.saldo_aprox)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
