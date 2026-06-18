// SDN — RNC Empleados (DGII).
// Lista de empleados con cédula/NSS, salario, AFP y ARS para reportes DGII
// (TSS, AFP, ARS, ISR). Soporta búsqueda y export CSV.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Search, FileDown, Printer } from 'lucide-react'

const fmt = (n: number) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function SdnRepRnc() {
  const { selectedCompany, selectedPoint } = useCompany()
  const [f, setF] = useState({ search: '', activos: true })

  const q = useQuery({
    queryKey: ['sdn-rep-rnc', selectedCompany, selectedPoint, f.activos, f.search],
    queryFn: () => api.sdnRepEmpleadosRnc({
      no_cia: selectedCompany, punto: selectedPoint,
      activos: f.activos, search: f.search || undefined,
    }),
    enabled: !!selectedCompany,
    placeholderData: (prev) => prev,
  })

  const rows = q.data || []
  const totalSalarios = rows.reduce((s: number, r: any) => s + Number(r.salario_mensual || 0), 0)

  const exportCsv = () => {
    const headers = ['No.', 'Cedula', 'NSS', 'Nombre', 'Apellido', 'Nomina',
      'Salario_Mensual', 'AFP_Codigo', 'AFP_Nombre', 'ARS_Codigo', 'ARS_Nombre',
      'Fecha_Ingreso', 'Fecha_Egreso']
    const esc = (v: any) => {
      const s = String(v ?? '')
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s
    }
    const data = rows.map((r: any) => [
      r.no_empleado, r.cedula, r.nss, r.nombre, r.apellido, r.nomina,
      r.salario_mensual, r.no_afp, r.afp, r.no_ars, r.ars,
      r.fecha_ingreso, r.fecha_egreso,
    ])
    const csv = [headers, ...data].map((row) => row.map(esc).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `sdn-rnc-empleados-${selectedCompany}.csv`
    a.click()
  }

  if (!selectedCompany) {
    return <p className="text-muted-foreground py-8 text-center">Seleccione una empresa.</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">RNC Empleados</h3>
        <p className="text-sm text-muted-foreground">
          Listado de empleados con cédula, NSS, salario, AFP y ARS para reportes
          a DGII / TSS. Equivale a la consulta legado <code>TSDN_EMPLEADO</code>.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded border bg-muted/30 p-3">
        <div className="grow max-w-md">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 h-9" value={f.search}
              onChange={(e) => setF({ ...f, search: e.target.value })}
              placeholder="Nombre, cédula o no. empleado…" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={f.activos}
            onChange={(e) => setF({ ...f, activos: e.target.checked })}
          />
          Solo activos
        </label>
        <Button size="sm" variant="outline" onClick={() => q.refetch()}>
          <Search className="h-4 w-4 mr-1" /> Buscar
        </Button>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
          <FileDown className="h-4 w-4 mr-1" /> CSV
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={rows.length === 0}
          onClick={() => {
            const qs = new URLSearchParams({
              no_cia: selectedCompany,
              ...(selectedPoint ? { punto: selectedPoint } : {}),
              activos: f.activos ? '1' : '0',
              ...(f.search ? { search: f.search } : {}),
            }).toString()
            window.open(`/print/sdn-rnc-empleados/_?${qs}`, '_blank')
          }}
        >
          <Printer className="h-4 w-4 mr-1" /> PDF
        </Button>
        <div className="ml-auto text-sm text-muted-foreground">
          {rows.length} empleados · masa salarial RD$ <span className="tabular-nums">{fmt(totalSalarios)}</span>
        </div>
      </div>

      {q.isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="rounded border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">No.</TableHead>
                <TableHead className="w-32">Cédula</TableHead>
                <TableHead className="w-28">NSS</TableHead>
                <TableHead>Nombre completo</TableHead>
                <TableHead className="w-20">Nómina</TableHead>
                <TableHead className="w-32 text-right">Salario mensual</TableHead>
                <TableHead className="w-36">AFP</TableHead>
                <TableHead className="w-36">ARS</TableHead>
                <TableHead className="w-28">Ingreso</TableHead>
                <TableHead className="w-20 text-center">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => {
                const activo = !r.fecha_egreso
                return (
                  <TableRow key={`${r.no_cia}-${r.no_empleado}`}>
                    <TableCell className="font-mono">{r.no_empleado}</TableCell>
                    <TableCell className="font-mono text-xs">{r.cedula}</TableCell>
                    <TableCell className="font-mono text-xs">{r.nss || '—'}</TableCell>
                    <TableCell>{r.nombre} {r.apellido}</TableCell>
                    <TableCell className="font-mono">{r.nomina}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{fmt(r.salario_mensual)}</TableCell>
                    <TableCell className="text-xs">{r.no_afp ? `${r.no_afp} — ${r.afp || ''}` : '—'}</TableCell>
                    <TableCell className="text-xs">{r.no_ars ? `${r.no_ars} — ${r.ars || ''}` : '—'}</TableCell>
                    <TableCell className="text-xs">{r.fecha_ingreso}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={activo ? 'default' : 'destructive'} className="text-xs">
                        {activo ? 'Activo' : 'Egresado'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-6">
                    No hay empleados que coincidan con el filtro.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
