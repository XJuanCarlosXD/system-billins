import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function TableShell({ rows, isLoading, cols, empty, max = '3xl' }: any) {
  if (isLoading) return <Skeleton className="h-32 w-full" />
  return (
    <div className={`rounded border max-w-${max}`}>
      <Table>
        <TableHeader><TableRow>{cols.map((c: any) => <TableHead key={c.key}>{c.label}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {rows.map((r: any, i: number) => (
            <TableRow key={i}>
              {cols.map((c: any) => <TableCell key={c.key} className={c.key === 'descripcion' || c.key === 'descri' ? '' : 'font-mono text-xs'}>{c.render ? c.render(r[c.key], r) : (r[c.key] ?? '—')}</TableCell>)}
            </TableRow>
          ))}
          {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={cols.length} className="text-center text-muted-foreground py-6">{empty}</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  )
}

export function AcfCias() {
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['acf-cias'], queryFn: api.acfListCias })
  return (
    <div className="space-y-4">
      <div><h3 className="text-base font-semibold">Compañías habilitadas para Activos Fijos</h3><p className="text-sm text-muted-foreground">Cuentas contables de caja, ganancia por venta, pérdida por venta y superávit por revalúo.</p></div>
      <TableShell isLoading={isLoading} rows={data} empty="Sin empresas habilitadas." max="5xl"
        cols={[
          { key: 'no_cia', label: 'No. CIA' },
          { key: 'descripcion', label: 'Descripción' },
          { key: 'activa', label: 'Activa', render: (v: any) => <Badge variant={v === 'S' ? 'default' : 'secondary'}>{v === 'S' ? 'Sí' : 'No'}</Badge> },
          { key: 'registro_cont', label: 'Reg. Cont.' },
          { key: 'cuenta_caja', label: 'Cuenta Caja' },
          { key: 'ganancia_por_venta', label: 'Ganancia x Venta' },
          { key: 'perdida_por_venta', label: 'Pérdida x Venta' },
          { key: 'superavit_por_reva', label: 'Superávit Revalúo' },
        ]} />
    </div>
  )
}

export function AcfPuntos() {
  const { selectedCompany } = useCompany()
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['acf-puntos', selectedCompany], queryFn: () => api.acfListPuntos(selectedCompany) })
  return (
    <div className="space-y-4">
      <div><h3 className="text-base font-semibold">Sucursales / Puntos ACF</h3><p className="text-sm text-muted-foreground">Empresa <b>{selectedCompany}</b>. Configuración de depreciación y período abierto.</p></div>
      <TableShell isLoading={isLoading} rows={data} empty="Sin puntos para esta empresa." max="5xl"
        cols={[
          { key: 'punto', label: 'Punto' },
          { key: 'descripcion', label: 'Descripción' },
          { key: 'activo', label: 'Activo', render: (v: any) => <Badge variant={v === 'S' ? 'default' : 'secondary'}>{v === 'S' ? 'Sí' : 'No'}</Badge> },
          { key: 'metodo_depre', label: 'Método Depre.' },
          { key: 'ano_proceso', label: 'Año' },
          { key: 'mes_proceso', label: 'Mes' },
          { key: 'prox_activo', label: 'Próx. Activo' },
        ]} />
    </div>
  )
}

export function AcfCategorias() {
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['acf-categorias'], queryFn: api.acfListCategorias })
  const keys = data[0] ? Object.keys(data[0]).slice(0, 6) : []
  return (
    <div className="space-y-4">
      <div><h3 className="text-base font-semibold">Categorías de Activos</h3><p className="text-sm text-muted-foreground">Clasificación contable para depreciación.</p></div>
      <TableShell isLoading={isLoading} rows={data} empty="Sin categorías." cols={keys.map(k => ({ key: k, label: k }))} />
    </div>
  )
}

export function AcfGrupos() {
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['acf-grupos'], queryFn: api.acfListGrupos })
  const keys = data[0] ? Object.keys(data[0]).slice(0, 6) : []
  return (
    <div className="space-y-4">
      <div><h3 className="text-base font-semibold">Grupos de Activos</h3></div>
      <TableShell isLoading={isLoading} rows={data} empty="Sin grupos." cols={keys.map(k => ({ key: k, label: k }))} />
    </div>
  )
}

export function AcfSubgrupos() {
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['acf-subgrupos'], queryFn: api.acfListSubgrupos })
  const keys = data[0] ? Object.keys(data[0]).slice(0, 6) : []
  return (
    <div className="space-y-4">
      <div><h3 className="text-base font-semibold">Subgrupos de Activos</h3></div>
      <TableShell isLoading={isLoading} rows={data} empty="Sin subgrupos." cols={keys.map(k => ({ key: k, label: k }))} />
    </div>
  )
}

export function AcfMarcas() {
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['acf-marcas'], queryFn: api.acfListMarcas })
  const keys = data[0] ? Object.keys(data[0]).slice(0, 4) : []
  return (
    <div className="space-y-4">
      <div><h3 className="text-base font-semibold">Marcas</h3></div>
      <TableShell isLoading={isLoading} rows={data} empty="Sin marcas." cols={keys.map(k => ({ key: k, label: k }))} />
    </div>
  )
}

export function AcfResponsables() {
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['acf-responsables'], queryFn: api.acfListResponsables })
  const keys = data[0] ? Object.keys(data[0]).slice(0, 4) : []
  return (
    <div className="space-y-4">
      <div><h3 className="text-base font-semibold">Responsables</h3><p className="text-sm text-muted-foreground">Personas asignadas como custodios de los activos.</p></div>
      <TableShell isLoading={isLoading} rows={data} empty="Sin responsables." cols={keys.map(k => ({ key: k, label: k }))} />
    </div>
  )
}

export function AcfDepartamentos() {
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['acf-departamentos'], queryFn: api.acfListDepartamentos })
  const keys = data[0] ? Object.keys(data[0]).slice(0, 4) : []
  return (
    <div className="space-y-4">
      <div><h3 className="text-base font-semibold">Departamentos</h3><p className="text-sm text-muted-foreground">Ubicación organizacional del activo.</p></div>
      <TableShell isLoading={isLoading} rows={data} empty="Sin departamentos." cols={keys.map(k => ({ key: k, label: k }))} />
    </div>
  )
}
