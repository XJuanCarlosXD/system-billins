// SDN — Generar Solicitud de Cheques (Fsdn409).
// Vista previa de qué solicitudes de cheque (TCHC_CHEQUE tipo SO) se generarían
// para la nómina seleccionada. La generación real queda en el sistema legado
// hasta validar la cuenta autorizada, beneficiario y aprobación por TCHC_USUARIOC.
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Banknote, Info } from 'lucide-react'
import { toast } from 'sonner'

const fmt = (n: number) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function SdnGenCheques() {
  const { selectedCompany, selectedPoint } = useCompany()
  const [f, setF] = useState({ nomina: '' })

  const nominas = useQuery({
    queryKey: ['sdn-nominas-chq', selectedCompany, selectedPoint],
    queryFn: () => api.sdnListNominas({
      no_cia: selectedCompany, punto: selectedPoint, estado: 'A', limit: 100,
    }),
    enabled: !!selectedCompany,
  })

  const preview = useMutation({
    mutationFn: () => api.sdnPreviewCheques({
      no_cia: selectedCompany, punto: selectedPoint, nomina: f.nomina,
    }),
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo calcular el previo'),
  })

  const data: any = preview.data
  const empleados: any[] = data?.empleados || []

  if (!selectedCompany) {
    return <p className="text-muted-foreground py-8 text-center">Seleccione una empresa.</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Generar Solicitud de Cheques de Nómina</h3>
        <p className="text-sm text-muted-foreground">
          Calcula qué solicitudes de cheque <Badge variant="outline" className="text-xs">SO</Badge> se
          generarían para los empleados con neto positivo. Equivale a <i>Fsdn409</i>
          · tabla <code>CHC.TCHC_CHEQUE</code>.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded border bg-muted/30 p-3">
        <div>
          <Label className="text-xs">Nómina</Label>
          <select
            className="border rounded px-3 py-2 text-sm h-9 min-w-[260px] bg-background"
            value={f.nomina}
            onChange={(e) => { setF({ nomina: e.target.value }); preview.reset() }}
          >
            <option value="">— seleccione —</option>
            {(nominas.data || []).map((n: any) => (
              <option key={`${n.nomina}-${n.ano_proceso}-${n.mes_proceso}-${n.periodo}`} value={n.nomina}>
                {n.nomina} — {n.descripcion} · {String(n.mes_proceso).padStart(2, '0')}/{n.ano_proceso} P{n.periodo}
              </option>
            ))}
          </select>
        </div>
        <Button size="sm" onClick={() => preview.mutate()} disabled={!f.nomina || preview.isPending}>
          <Banknote className="h-4 w-4 mr-1" />
          {preview.isPending ? 'Calculando…' : 'Calcular solicitudes'}
        </Button>
      </div>

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Empleados a pagar</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{data.totales.empleados}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total a desembolsar</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">RD$ {fmt(data.totales.total_neto)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Próximo No. SO</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold font-mono">
              SO-{String(data.totales.prox_no_solicitud).padStart(7, '0')}
            </CardContent>
          </Card>
        </div>
      )}

      {preview.isPending ? <Skeleton className="h-40 w-full" /> : data ? (
        <>
          <div className="rounded border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Empleado</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="w-32">Cédula</TableHead>
                  <TableHead>Cuenta banco</TableHead>
                  <TableHead className="w-32 text-right">Neto a pagar (RD$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empleados.map((e) => (
                  <TableRow key={e.no_empleado}>
                    <TableCell className="font-mono">{e.no_empleado}</TableCell>
                    <TableCell>{e.nombre_empleado}</TableCell>
                    <TableCell className="font-mono text-xs">{e.cedula}</TableCell>
                    <TableCell className="font-mono text-xs">{e.cuenta_banco || <span className="text-destructive">sin cuenta</span>}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{fmt(e.neto)}</TableCell>
                  </TableRow>
                ))}
                {empleados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      No hay empleados con neto positivo para pagar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="rounded border border-blue-200 bg-blue-50 text-blue-900 p-3 text-xs flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              La emisión real de TCHC_CHEQUE requiere validar cuenta autorizada
              (<code>TCHC_USUARIOC</code>), beneficiario y permisos de creación.
              Por ahora este módulo solo muestra el previo; la generación real se
              ejecuta desde el sistema legado.
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Seleccione una nómina y haga clic en <b>Calcular solicitudes</b> para ver el previo.
        </p>
      )}
    </div>
  )
}
