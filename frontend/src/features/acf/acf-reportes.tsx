// ACF — Reportes consolidados de Activos Fijos.
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { PieChart, Building2, TrendingDown, Printer, FileText } from 'lucide-react'

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtInt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', { maximumFractionDigits: 0 })

export function AcfReportes() {
  const { selectedCompany, selectedPoint } = useCompany()

  const resQ = useQuery({
    queryKey: ['acf-rep-res', selectedCompany, selectedPoint],
    queryFn: () => api.acfRepResumen(selectedCompany, selectedPoint),
    enabled: !!selectedCompany,
  })
  const valQ = useQuery({
    queryKey: ['acf-rep-val', selectedCompany, selectedPoint],
    queryFn: () => api.acfRepValuacion(selectedCompany, selectedPoint),
    enabled: !!selectedCompany,
  })
  const grpQ = useQuery({
    queryKey: ['acf-rep-grp', selectedCompany, selectedPoint],
    queryFn: () => api.acfRepPorGrupo(selectedCompany, selectedPoint),
    enabled: !!selectedCompany,
  })
  const depQ = useQuery({
    queryKey: ['acf-rep-dep', selectedCompany, selectedPoint],
    queryFn: () => api.acfRepPorDepartamento(selectedCompany, selectedPoint),
    enabled: !!selectedCompany,
  })

  const res: any = resQ.data || {}
  const val: any = valQ.data || {}
  const qs = `no_cia=${selectedCompany}${selectedPoint ? `&punto=${selectedPoint}` : ''}`
  const openPrint = (codigo: string, id = '-') =>
    window.open(`/print/${codigo}/${encodeURIComponent(id)}?${qs}`, '_blank')

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Reportes de Activos Fijos</h3>
          <p className="text-sm text-muted-foreground">
            Resumen consolidado de inventario, valuación contable y distribución
            por grupo / departamento.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => openPrint('listado-activos-acf')}>
          <FileText className="h-4 w-4 mr-1" /> Listado completo
        </Button>
      </div>

      {resQ.isLoading ? <Skeleton className="h-24 w-full" /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total activos</CardTitle>
          </CardHeader><CardContent className="text-2xl font-semibold">{fmtInt(res.total)}</CardContent></Card>
          <Card><CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Activos</CardTitle>
          </CardHeader><CardContent className="text-2xl font-semibold text-emerald-600">
            {fmtInt(res.activos)}
          </CardContent></Card>
          <Card><CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Retirados</CardTitle>
          </CardHeader><CardContent className="text-2xl font-semibold text-muted-foreground">
            {fmtInt(res.retirados)}
          </CardContent></Card>
          <Card><CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Sin retirar</CardTitle>
          </CardHeader><CardContent className="text-2xl font-semibold">{fmtInt(res.sin_retirar)}</CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingDown className="h-4 w-4" /> Valuación contable
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => openPrint('valuacion-acf')}>
            <Printer className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {valQ.isLoading ? <Skeleton className="h-20 w-full" /> : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Valor original</div>
                <div className="font-semibold tabular-nums">RD$ {fmt(val.valor_original)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Mejoras</div>
                <div className="font-semibold tabular-nums">RD$ {fmt(val.mejoras)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Revalorización</div>
                <div className="font-semibold tabular-nums">RD$ {fmt(val.revalorizacion)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Depreciación acumulada</div>
                <div className="font-semibold tabular-nums text-amber-700">
                  RD$ {fmt(val.depre_acumu)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Valor en libros</div>
                <div className="font-semibold tabular-nums text-emerald-700">
                  RD$ {fmt(val.valor_libros)}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChart className="h-4 w-4" /> Por grupo
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => openPrint('activos-por-grupo-acf')}>
              <Printer className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Grupo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {grpQ.isLoading ? (
                  <TableRow><TableCell colSpan={2} className="py-6 text-center text-muted-foreground">Cargando…</TableCell></TableRow>
                ) : (grpQ.data || []).length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="py-6 text-center text-muted-foreground">Sin datos.</TableCell></TableRow>
                ) : (grpQ.data || []).map((g: any) => (
                  <TableRow key={g.grupo}>
                    <TableCell className="font-mono">{g.grupo}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(g.cantidad)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Por departamento
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => openPrint('activos-por-departamento-acf')}>
              <Printer className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Depto</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">V. original</TableHead>
                <TableHead className="text-right">Depre. acum.</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {depQ.isLoading ? (
                  <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Cargando…</TableCell></TableRow>
                ) : (depQ.data || []).length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Sin datos.</TableCell></TableRow>
                ) : (depQ.data || []).map((d: any) => (
                  <TableRow key={d.departamento}>
                    <TableCell className="font-mono">{d.departamento}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(d.cantidad)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(d.valor_original)}</TableCell>
                    <TableCell className="text-right tabular-nums text-amber-700">
                      {fmt(d.depre_acumu)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
