import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table'
import { downloadCsv } from '@/lib/csv-utils'

interface AgingRow {
  no_proveedor: string; nombre: string
  corriente: number; d30: number; d60: number; d90: number; mas90: number; total: number
}

const fmt = (n: number) => n?.toLocaleString('es-DO', { minimumFractionDigits: 2 }) ?? '0.00'
const sum = (rows: AgingRow[], k: keyof AgingRow) =>
  rows.reduce((a, r) => a + (r[k] as number), 0)

export function CxpAging() {
  const { selectedCompany: noCia, selectedPoint: punto } = useCompany()
  const [busqueda, setBusqueda] = useState('')

  const { data = [], isLoading, isError } = useQuery<AgingRow[]>({
    queryKey: ['cxp-aging', noCia, punto],
    queryFn: () => api.cxpGetAging({ no_cia: noCia, punto }),
    staleTime: 60_000,
    enabled: !!noCia,
  })

  const filtrado = busqueda
    ? data.filter(r =>
        r.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        r.no_proveedor.includes(busqueda)
      )
    : data

  function exportPdf() {
    const qs = new URLSearchParams({ no_cia: noCia, punto: punto || '' }).toString()
    window.open(`/print/cxp-rep-envejecimiento/current?${qs}`, '_blank')
  }

  function exportExcel() {
    downloadCsv(filtrado.map(r => ({
      No: r.no_proveedor, Proveedor: r.nombre,
      Corriente: r.corriente, '1-30d': r.d30, '31-60d': r.d60,
      '61-90d': r.d90, '+90d': r.mas90, Total: r.total,
    })), 'cxp-aging.csv')
  }

  if (!noCia) {
    return <p className="text-muted-foreground py-8 text-center">Seleccione una empresa para ver la antigüedad.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Input
          placeholder="Buscar proveedor por nombre o código…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-64"
        />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportPdf}>PDF</Button>
          <Button variant="outline" size="sm" onClick={exportExcel}>Excel</Button>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead className="text-right">Corriente</TableHead>
              <TableHead className="text-right">1–30 días</TableHead>
              <TableHead className="text-right">31–60 días</TableHead>
              <TableHead className="text-right">61–90 días</TableHead>
              <TableHead className="text-right">+90 días</TableHead>
              <TableHead className="text-right font-bold">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
            ) : isError ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-red-500">Error al cargar datos. Intente nuevamente.</TableCell></TableRow>
            ) : filtrado.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                {busqueda
                  ? `No se encontraron proveedores con "${busqueda}".`
                  : 'No hay cuentas pendientes de pago.'}
              </TableCell></TableRow>
            ) : filtrado.map(r => (
              <TableRow key={r.no_proveedor} className="hover:bg-muted/50">
                <TableCell className="font-mono text-xs">{r.no_proveedor}</TableCell>
                <TableCell className="max-w-[180px] truncate" title={r.nombre}>{r.nombre}</TableCell>
                <TableCell className="text-right font-mono text-sm">{fmt(r.corriente)}</TableCell>
                <TableCell className={`text-right font-mono text-sm ${r.d30 > 0 ? 'text-yellow-700' : ''}`}>{fmt(r.d30)}</TableCell>
                <TableCell className={`text-right font-mono text-sm ${r.d60 > 0 ? 'text-orange-600' : ''}`}>{fmt(r.d60)}</TableCell>
                <TableCell className={`text-right font-mono text-sm ${r.d90 > 0 ? 'text-red-600' : ''}`}>{fmt(r.d90)}</TableCell>
                <TableCell className={`text-right font-mono text-sm font-semibold ${r.mas90 > 0 ? 'text-red-700' : ''}`}>{fmt(r.mas90)}</TableCell>
                <TableCell className="text-right font-mono text-sm font-bold">{fmt(r.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          {filtrado.length > 0 && (
            <TableFooter>
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={2}>TOTAL ({filtrado.length} proveedores)</TableCell>
                <TableCell className="text-right font-mono">{fmt(sum(filtrado, 'corriente'))}</TableCell>
                <TableCell className="text-right font-mono">{fmt(sum(filtrado, 'd30'))}</TableCell>
                <TableCell className="text-right font-mono">{fmt(sum(filtrado, 'd60'))}</TableCell>
                <TableCell className="text-right font-mono">{fmt(sum(filtrado, 'd90'))}</TableCell>
                <TableCell className="text-right font-mono">{fmt(sum(filtrado, 'mas90'))}</TableCell>
                <TableCell className="text-right font-mono">{fmt(sum(filtrado, 'total'))}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  )
}
