import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function Cols({ rows, isLoading, cols, empty }: { rows: any[]; isLoading: boolean; cols: { key: string; label: string; render?: (v: any, r: any) => any }[]; empty: string }) {
  if (isLoading) return <Skeleton className="h-40 w-full" />
  return (
    <div className="rounded border max-w-3xl">
      <Table>
        <TableHeader><TableRow>{cols.map(c => <TableHead key={c.key}>{c.label}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {cols.map(c => <TableCell key={c.key} className={c.key === 'descripcion' || c.key === 'descri_corta' ? '' : 'font-mono text-xs'}>{c.render ? c.render(r[c.key], r) : (r[c.key] ?? '—')}</TableCell>)}
            </TableRow>
          ))}
          {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={cols.length} className="text-center text-muted-foreground py-6">{empty}</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  )
}

export function SdnCias() {
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['sdn-cias'], queryFn: api.sdnListCias })
  return (
    <div className="space-y-4">
      <div><h3 className="text-base font-semibold">Compañías Nómina</h3><p className="text-sm text-muted-foreground">Datos del empleador, RNC patronal, topes ISR/AFP y salario mínimo.</p></div>
      <Cols isLoading={isLoading} rows={data} empty="Sin empresas."
        cols={[
          { key: 'no_cia', label: 'CIA' },
          { key: 'descripcion', label: 'Descripción' },
          { key: 'razon_social', label: 'Razón social' },
          { key: 'no_patronal', label: 'RNC Patronal' },
          { key: 'activa', label: 'Activa', render: (v) => <Badge variant={v === 'S' ? 'default' : 'secondary'}>{v === 'S' ? 'Sí' : 'No'}</Badge> },
          { key: 'salario_minimo', label: 'Sal. mín.' },
          { key: 'tope_salario_ss', label: 'Tope SS' },
          { key: 'tope_salario_afp', label: 'Tope AFP' },
        ]}
      />
    </div>
  )
}

export function SdnAfp() {
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['sdn-afp'], queryFn: api.sdnListAfp })
  return (
    <div className="space-y-4">
      <div><h3 className="text-base font-semibold">AFP</h3><p className="text-sm text-muted-foreground">Administradoras de Fondos de Pensiones reconocidas.</p></div>
      <Cols isLoading={isLoading} rows={data} empty="Sin AFP."
        cols={[{ key: 'no_afp', label: 'No.' }, { key: 'descripcion', label: 'Descripción' }]} />
    </div>
  )
}

export function SdnArs() {
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['sdn-ars'], queryFn: api.sdnListArs })
  return (
    <div className="space-y-4">
      <div><h3 className="text-base font-semibold">ARS</h3><p className="text-sm text-muted-foreground">Administradoras de Riesgos de Salud.</p></div>
      <Cols isLoading={isLoading} rows={data} empty="Sin ARS."
        cols={[{ key: 'no_ars', label: 'No.' }, { key: 'descripcion', label: 'Descripción' }]} />
    </div>
  )
}

export function SdnGerencias() {
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['sdn-gerencias'], queryFn: api.sdnListGerencias })
  return (
    <div className="space-y-4">
      <div><h3 className="text-base font-semibold">Gerencias</h3></div>
      <Cols isLoading={isLoading} rows={data} empty="Sin gerencias."
        cols={[{ key: 'no_gerencia', label: 'Gerencia' }, { key: 'descripcion', label: 'Descripción' }]} />
    </div>
  )
}

export function SdnAreas() {
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['sdn-areas'], queryFn: api.sdnListAreas })
  return (
    <div className="space-y-4">
      <div><h3 className="text-base font-semibold">Áreas</h3></div>
      <Cols isLoading={isLoading} rows={data} empty="Sin áreas."
        cols={[
          { key: 'no_gerencia', label: 'Gerencia' },
          { key: 'no_area', label: 'Área' },
          { key: 'descripcion', label: 'Descripción' },
        ]} />
    </div>
  )
}

export function SdnDeptos() {
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['sdn-deptos'], queryFn: api.sdnListDeptos })
  return (
    <div className="space-y-4">
      <div><h3 className="text-base font-semibold">Departamentos</h3></div>
      <Cols isLoading={isLoading} rows={data} empty="Sin departamentos."
        cols={[
          { key: 'no_gerencia', label: 'Gerencia' },
          { key: 'no_area', label: 'Área' },
          { key: 'no_depto', label: 'Depto.' },
          { key: 'descripcion', label: 'Descripción' },
        ]} />
    </div>
  )
}

export function SdnIngresos() {
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['sdn-ingresos'], queryFn: () => api.sdnListIngresos() })
  return (
    <div className="space-y-4">
      <div><h3 className="text-base font-semibold">Conceptos de Ingreso</h3><p className="text-sm text-muted-foreground">Sueldo, horas extras, comisiones, vacaciones, regalía, etc.</p></div>
      <Cols isLoading={isLoading} rows={data} empty="Sin ingresos."
        cols={[
          { key: 'no_ingreso', label: 'Código' },
          { key: 'descripcion', label: 'Descripción' },
          { key: 'descri_corta', label: 'Corto' },
          { key: 'tipo_ingreso', label: 'Tipo' },
          { key: 'clase_ingreso', label: 'Clase' },
          { key: 'valido_regalia', label: 'Regalía' },
          { key: 'no_cotiza_tss', label: 'No-TSS' },
          { key: 'status', label: 'Status' },
        ]} />
    </div>
  )
}

export function SdnDeducciones() {
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['sdn-deducciones'], queryFn: () => api.sdnListDeducciones() })
  return (
    <div className="space-y-4">
      <div><h3 className="text-base font-semibold">Conceptos de Deducción</h3><p className="text-sm text-muted-foreground">ISR, AFP, SFS, préstamos, garantías, otras retenciones.</p></div>
      <Cols isLoading={isLoading} rows={data} empty="Sin deducciones."
        cols={[
          { key: 'no_deduccion', label: 'Código' },
          { key: 'descripcion', label: 'Descripción' },
          { key: 'tipo_deduccion', label: 'Tipo' },
          { key: 'empleado_patrono', label: 'E/P' },
          { key: 'porciento_monto', label: '%/$' },
          { key: 'antes_isr', label: 'Antes ISR' },
          { key: 'valor', label: 'Valor' },
          { key: 'cuenta', label: 'Cuenta' },
        ]} />
    </div>
  )
}
