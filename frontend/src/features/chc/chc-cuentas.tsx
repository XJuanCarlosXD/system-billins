import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })

export function ChcCuentas() {
  const { selectedCompany, selectedPoint } = useCompany()
  const balQ = useQuery({ queryKey: ['chc-balance', selectedCompany, selectedPoint], queryFn: () => api.chcRepBalance({ no_cia: selectedCompany, punto: selectedPoint }) })
  const rows = balQ.data || []
  const totalDOP = rows.filter((r: any) => r.moneda === 'P').reduce((s: number, r: any) => s + Number(r.saldo_aprox || 0), 0)
  const totalUSD = rows.filter((r: any) => r.moneda === 'D').reduce((s: number, r: any) => s + Number(r.saldo_aprox || 0), 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Cuentas activas</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{rows.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saldo total RD$</CardTitle></CardHeader><CardContent className="text-xl font-semibold tabular-nums">{fmt(totalDOP)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saldo total US$</CardTitle></CardHeader><CardContent className="text-xl font-semibold tabular-nums">{fmt(totalUSD)}</CardContent></Card>
      </div>
      <div className="rounded border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuenta</TableHead>
              <TableHead>Moneda</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Activa</TableHead>
              <TableHead className="text-right">Saldo Inicial</TableHead>
              <TableHead className="text-right">Cheques Mes</TableHead>
              <TableHead className="text-right">Depósito Mes</TableHead>
              <TableHead className="text-right">D/C Mes</TableHead>
              <TableHead className="text-right">Saldo Aprox</TableHead>
              <TableHead className="text-right">Próx. Cheque</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c: any) => (
              <TableRow key={c.cuenta_banco}>
                <TableCell className="font-mono">{c.cuenta_banco}</TableCell>
                <TableCell><Badge variant="outline">{c.moneda === 'P' ? 'DOP' : c.moneda === 'D' ? 'USD' : c.moneda}</Badge></TableCell>
                <TableCell className="text-xs">{String(c.mes_proceso).padStart(2, '0')}/{c.ano_proceso}</TableCell>
                <TableCell>{c.activa === 'S' ? 'Sí' : 'No'}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(c.saldo_inicial)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(c.che_mes)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(c.deposito_mes)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt((c.cre_mes || 0) - (c.deb_mes || 0))}</TableCell>
                <TableCell className={`text-right tabular-nums font-semibold ${Number(c.saldo_aprox) < 0 ? 'text-destructive' : ''}`}>{fmt(c.saldo_aprox)}</TableCell>
                <TableCell className="text-right tabular-nums text-xs">{c.prox_cheque}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">Sin cuentas.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
