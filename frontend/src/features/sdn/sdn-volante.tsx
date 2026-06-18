import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { FileSpreadsheet, Search, Printer } from 'lucide-react'

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (s: any) => (s ? String(s).slice(0, 10) : '')

const MONEDA_LABELS: Record<string, string> = { P: 'RD$', D: 'US$' }

type Nomina = {
  no_cia: string; punto: string; nomina: string
  descripcion: string; forma_pago: string
  fecha_inicial?: string; fecha_final?: string
  mes_proceso: number; ano_proceso: number; periodo?: number
  calculo_nomina: string; estado: string; tipo_moneda?: string
  cuenta_contable: string
}

export function SdnVolante() {
  const { selectedCompany, selectedPoint } = useCompany()
  const [nominaSel, setNominaSel] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const nominasQ = useQuery({
    queryKey: ['sdn-nominas', selectedCompany, selectedPoint],
    queryFn: () => api.sdnListNominas({
      no_cia: selectedCompany, punto: selectedPoint, limit: 200,
    }),
  })

  const lista: Nomina[] = (nominasQ.data || [])
  const nomina = lista.find((n) => n.nomina === nominaSel)

  const volanteQ = useQuery({
    queryKey: ['sdn-volante', selectedCompany, selectedPoint, nominaSel],
    queryFn: () => api.sdnGetVolante({
      no_cia: selectedCompany, punto: selectedPoint, nomina: nominaSel,
    }),
    enabled: !!nominaSel,
  })

  const todos = (volanteQ.data?.empleados || []) as any[]
  const totales = volanteQ.data?.totales || { empleados: 0, salario: 0, ingresos: 0, deducciones: 0, neto: 0 }

  const empleados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return todos
    return todos.filter((e) =>
      String(e.no_empleado).includes(q) ||
      (e.nombre_empleado || '').toLowerCase().includes(q) ||
      (e.cedula || '').includes(q)
    )
  }, [todos, busqueda])

  const moneda = MONEDA_LABELS[nomina?.tipo_moneda || 'P']

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Volante / Pre-Nómina</h3>
        <p className="text-sm text-muted-foreground">
          Previsualización del cálculo de nómina por empleado: salario base, ingresos y
          deducciones del período, con el neto a pagar. Equivale al volante impreso de
          <i> Fsdn206</i>. Fuente: <code>TSDN_EMPLEADO</code> + <code>TSDN_MOVIMIENTO</code>.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Selección
          </CardTitle>
          {nominaSel && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const qs = new URLSearchParams({ no_cia: selectedCompany, punto: selectedPoint }).toString()
                window.open(`/print/sdn-nomina/${encodeURIComponent(nominaSel)}?${qs}`, '_blank')
              }}
            >
              <Printer className="h-4 w-4 mr-1" /> Imprimir nómina
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nómina</Label>
              <Select value={nominaSel} onValueChange={setNominaSel}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecciona una nómina…" /></SelectTrigger>
                <SelectContent>
                  {lista.map((n) => (
                    <SelectItem key={n.nomina} value={n.nomina}>
                      {n.nomina} — {n.descripcion} · {String(n.mes_proceso).padStart(2, '0')}/{n.ano_proceso}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Buscar empleado</Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                       placeholder="Nombre, código o cédula" className="h-9 pl-8" />
              </div>
            </div>
          </div>

          {nomina && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm flex flex-wrap gap-x-6 gap-y-1">
              <span>
                <span className="text-muted-foreground">Período: </span>
                <span className="tabular-nums">
                  {String(nomina.mes_proceso).padStart(2, '0')}/{nomina.ano_proceso}
                  {nomina.periodo ? ` · #${nomina.periodo}` : ''}
                </span>
              </span>
              <span>
                <span className="text-muted-foreground">Fechas: </span>
                {fmtDate(nomina.fecha_inicial)} → {fmtDate(nomina.fecha_final)}
              </span>
              <span>
                <span className="text-muted-foreground">Forma pago: </span>
                {nomina.forma_pago === 'M' ? 'Mensual' : nomina.forma_pago === 'Q' ? 'Quincenal' : 'Semanal'}
              </span>
              <span>
                <span className="text-muted-foreground">Cálculo: </span>
                {nomina.calculo_nomina === 'S'
                  ? <Badge variant="outline">Calculada</Badge>
                  : <Badge variant="secondary">Pendiente</Badge>}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {nominaSel && (
        <div className="rounded border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Código</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead className="w-32">Cédula</TableHead>
                <TableHead className="w-32 text-right">Salario base</TableHead>
                <TableHead className="w-32 text-right">Ingresos</TableHead>
                <TableHead className="w-32 text-right">Deducciones</TableHead>
                <TableHead className="w-32 text-right">Neto</TableHead>
                <TableHead className="w-12 text-right">PDF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {volanteQ.isLoading ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Cargando volante…
                </TableCell></TableRow>
              ) : empleados.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  {busqueda
                    ? 'Sin empleados que coincidan con la búsqueda.'
                    : 'Sin empleados activos en esta nómina.'}
                </TableCell></TableRow>
              ) : (
                empleados.map((e) => {
                  const neto = Number(e.neto || 0)
                  const isNeg = neto < 0
                  return (
                    <TableRow key={e.no_empleado}>
                      <TableCell className="font-mono">{String(e.no_empleado).padStart(4, '0')}</TableCell>
                      <TableCell>{e.nombre_empleado}</TableCell>
                      <TableCell className="font-mono text-xs">{e.cedula}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(e.salario_mensual)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(e.total_ingresos)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(e.total_deducciones)}</TableCell>
                      <TableCell className={`text-right tabular-nums font-medium ${isNeg ? 'text-destructive' : ''}`}>
                        {fmt(neto)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" title="Volante individual PDF"
                          onClick={() => {
                            const qs = new URLSearchParams({
                              no_cia: selectedCompany, punto: selectedPoint,
                              ano: String(nomina?.ano_proceso || ''),
                              mes: String(nomina?.mes_proceso || ''),
                              periodo: String(nomina?.periodo || 1),
                            }).toString()
                            const id = `${nominaSel}__${e.no_empleado}`
                            window.open(`/print/volante-pago/${encodeURIComponent(id)}?${qs}`, '_blank')
                          }}>
                          <Printer className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
            {empleados.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-medium">
                    {totales.empleados} empleado{totales.empleados === 1 ? '' : 's'} · Moneda {moneda}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {moneda} {fmt(totales.salario)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {moneda} {fmt(totales.ingresos)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {moneda} {fmt(totales.deducciones)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {moneda} {fmt(totales.neto)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      )}
    </div>
  )
}
