import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { CatalogCrud } from '@/components/catalog/catalog-crud'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// -----------------------------------------------------------------------------
// Catálogos read-only (cias, ingresos, deducciones): estos requieren un CRUD
// con muchos flags/topes/relaciones — se dejan como listado hasta un spec
// dedicado.
// -----------------------------------------------------------------------------

function ReadOnlyCols({
  rows, isLoading, cols, empty,
}: {
  rows: any[]
  isLoading: boolean
  cols: { key: string; label: string; render?: (v: any, r: any) => any }[]
  empty: string
}) {
  if (isLoading) return <Skeleton className="h-40 w-full" />
  return (
    <div className="rounded border max-w-3xl">
      <Table>
        <TableHeader>
          <TableRow>{cols.map(c => <TableHead key={c.key}>{c.label}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {cols.map(c => (
                <TableCell
                  key={c.key}
                  className={c.key === 'descripcion' || c.key === 'descri_corta' ? '' : 'font-mono text-xs'}
                >
                  {c.render ? c.render(r[c.key], r) : (r[c.key] ?? '—')}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {!isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={cols.length} className="text-center text-muted-foreground py-6">
                {empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export function SdnCias() {
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['sdn-cias'], queryFn: api.sdnListCias })
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Compañías Nómina</h3>
        <p className="text-sm text-muted-foreground">
          Datos del empleador, RNC patronal, topes ISR/AFP y salario mínimo. Read-only por ahora.
        </p>
      </div>
      <ReadOnlyCols
        isLoading={isLoading}
        rows={data}
        empty="Sin empresas."
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
  return (
    <CatalogCrud
      title="AFP"
      description="Administradoras de Fondos de Pensiones reconocidas."
      queryKey={['sdn-afp']}
      fetchList={() => api.sdnListAfp()}
      createFn={(d) => api.sdnSaveAfp(d)}
      updateFn={(_r, d) => api.sdnSaveAfp(d)}
      deleteFn={(row) => api.sdnDeleteAfp(row.no_afp)}
      pkLabel={(r) => r.no_afp}
      maxWidth="2xl"
      fields={[
        { key: 'no_afp', label: 'No.', isPk: true, required: true, maxLength: 2, colClass: 'font-mono' },
        { key: 'descripcion', label: 'Descripción', required: true, colClass: '' },
      ]}
    />
  )
}

export function SdnArs() {
  return (
    <CatalogCrud
      title="ARS"
      description="Administradoras de Riesgos de Salud."
      queryKey={['sdn-ars']}
      fetchList={() => api.sdnListArs()}
      createFn={(d) => api.sdnSaveArs(d)}
      updateFn={(_r, d) => api.sdnSaveArs(d)}
      deleteFn={(row) => api.sdnDeleteArs(row.no_ars)}
      pkLabel={(r) => r.no_ars}
      maxWidth="2xl"
      fields={[
        { key: 'no_ars', label: 'No.', isPk: true, required: true, maxLength: 2, colClass: 'font-mono' },
        { key: 'descripcion', label: 'Descripción', required: true, colClass: '' },
      ]}
    />
  )
}

export function SdnGerencias() {
  return (
    <CatalogCrud
      title="Gerencias"
      description="Nivel superior de la jerarquía organizacional."
      queryKey={['sdn-gerencias']}
      fetchList={() => api.sdnListGerencias()}
      createFn={(d) => api.sdnSaveGerencia(d)}
      updateFn={(_r, d) => api.sdnSaveGerencia(d)}
      deleteFn={(row) => api.sdnDeleteGerencia(row.no_gerencia)}
      pkLabel={(r) => r.no_gerencia}
      maxWidth="2xl"
      fields={[
        { key: 'no_gerencia', label: 'Gerencia', isPk: true, required: true, maxLength: 2, colClass: 'font-mono' },
        { key: 'descripcion', label: 'Descripción', required: true, colClass: '' },
      ]}
    />
  )
}

export function SdnAreas() {
  const gerenciasQ = useQuery<any[]>({ queryKey: ['sdn-gerencias'], queryFn: () => api.sdnListGerencias() })
  return (
    <CatalogCrud
      title="Áreas"
      description="Cada área pertenece a una gerencia."
      queryKey={['sdn-areas']}
      fetchList={() => api.sdnListAreas()}
      createFn={(d) => api.sdnSaveArea(d)}
      updateFn={(_r, d) => api.sdnSaveArea(d)}
      deleteFn={(row) => api.sdnDeleteArea(row.no_gerencia, row.no_area)}
      pkLabel={(r) => `${r.no_gerencia}/${r.no_area}`}
      maxWidth="3xl"
      fields={[
        {
          key: 'no_gerencia', label: 'Gerencia', isPk: true, required: true,
          type: 'select', colClass: 'font-mono',
          options: (gerenciasQ.data || []).map((g: any) => ({
            value: g.no_gerencia, label: `${g.no_gerencia} — ${g.descripcion}`,
          })),
        },
        { key: 'no_area', label: 'Área', isPk: true, required: true, maxLength: 2, colClass: 'font-mono' },
        { key: 'descripcion', label: 'Descripción', required: true, colClass: '' },
      ]}
    />
  )
}

export function SdnDeptos() {
  const gerenciasQ = useQuery<any[]>({ queryKey: ['sdn-gerencias'], queryFn: () => api.sdnListGerencias() })
  const areasQ = useQuery<any[]>({ queryKey: ['sdn-areas'], queryFn: () => api.sdnListAreas() })
  return (
    <CatalogCrud
      title="Departamentos"
      description="Cada departamento pertenece a una gerencia y área."
      queryKey={['sdn-deptos']}
      fetchList={() => api.sdnListDeptos()}
      createFn={(d) => api.sdnSaveDepto(d)}
      updateFn={(_r, d) => api.sdnSaveDepto(d)}
      deleteFn={(row) => api.sdnDeleteDepto(row.no_gerencia, row.no_area, row.no_depto)}
      pkLabel={(r) => `${r.no_gerencia}/${r.no_area}/${r.no_depto}`}
      maxWidth="4xl"
      fields={[
        {
          key: 'no_gerencia', label: 'Gerencia', isPk: true, required: true, type: 'select',
          colClass: 'font-mono',
          options: (gerenciasQ.data || []).map((g: any) => ({
            value: g.no_gerencia, label: `${g.no_gerencia} — ${g.descripcion}`,
          })),
        },
        {
          key: 'no_area', label: 'Área', isPk: true, required: true, type: 'select',
          colClass: 'font-mono',
          options: (areasQ.data || []).map((a: any) => ({
            value: a.no_area, label: `${a.no_gerencia}/${a.no_area} — ${a.descripcion}`,
          })),
        },
        { key: 'no_depto', label: 'Depto.', isPk: true, required: true, maxLength: 2, colClass: 'font-mono' },
        { key: 'descripcion', label: 'Descripción', required: true, colClass: '' },
      ]}
    />
  )
}

export function SdnIngresos() {
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['sdn-ingresos'], queryFn: () => api.sdnListIngresos() })
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Conceptos de Ingreso</h3>
        <p className="text-sm text-muted-foreground">
          Sueldo, horas extras, comisiones, vacaciones, regalía, etc. Read-only por ahora.
        </p>
      </div>
      <ReadOnlyCols
        isLoading={isLoading}
        rows={data}
        empty="Sin ingresos."
        cols={[
          { key: 'no_ingreso', label: 'Código' },
          { key: 'descripcion', label: 'Descripción' },
          { key: 'descri_corta', label: 'Corto' },
          { key: 'tipo_ingreso', label: 'Tipo' },
          { key: 'clase_ingreso', label: 'Clase' },
          { key: 'valido_regalia', label: 'Regalía' },
          { key: 'no_cotiza_tss', label: 'No-TSS' },
          { key: 'status', label: 'Status' },
        ]}
      />
    </div>
  )
}

export function SdnDeducciones() {
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['sdn-deducciones'], queryFn: () => api.sdnListDeducciones() })
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Conceptos de Deducción</h3>
        <p className="text-sm text-muted-foreground">
          ISR, AFP, SFS, préstamos, garantías, otras retenciones. Read-only por ahora.
        </p>
      </div>
      <ReadOnlyCols
        isLoading={isLoading}
        rows={data}
        empty="Sin deducciones."
        cols={[
          { key: 'no_deduccion', label: 'Código' },
          { key: 'descripcion', label: 'Descripción' },
          { key: 'tipo_deduccion', label: 'Tipo' },
          { key: 'empleado_patrono', label: 'E/P' },
          { key: 'porciento_monto', label: '%/$' },
          { key: 'antes_isr', label: 'Antes ISR' },
          { key: 'valor', label: 'Valor' },
          { key: 'cuenta', label: 'Cuenta' },
        ]}
      />
    </div>
  )
}
