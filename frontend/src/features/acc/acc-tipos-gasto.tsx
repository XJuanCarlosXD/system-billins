import { api } from '@/lib/regal-general-api'
import { CatalogCrud } from '@/components/catalog/catalog-crud'
import { Badge } from '@/components/ui/badge'

export function AccTiposGasto() {
  return (
    <CatalogCrud
      title="Tipos de Gasto"
      description={
        <>
          Catálogo de conceptos de gasto con su <b>cuenta contable</b> de débito.
          Equivale a <i>Facc108</i>. Fuente: <code>TACC_TGASTOS</code>.
        </>
      }
      queryKey={['acc-tgasto']}
      fetchList={() => api.accListTiposGasto()}
      createFn={(d) => api.accSaveTipoGasto(d)}
      updateFn={(_row, d) => api.accSaveTipoGasto(d)}
      deleteFn={(row) => api.accDeleteTipoGasto(row.tipo_gasto)}
      pkLabel={(r) => r.tipo_gasto}
      fields={[
        { key: 'tipo_gasto', label: 'Código', isPk: true, required: true, uppercase: true, maxLength: 6, colClass: 'font-mono' },
        { key: 'descripcion', label: 'Descripción', required: true, colClass: '' },
        { key: 'cuenta', label: 'Cuenta contable', required: true, colClass: 'font-mono text-xs' },
        { key: 'centro_costo', label: 'Centro de costo', defaultValue: '0000000000', colClass: 'font-mono text-xs' },
        {
          key: 'activo', label: 'Estado', type: 'select', defaultValue: 'S',
          options: [{ value: 'S', label: 'Activo' }, { value: 'N', label: 'Inactivo' }],
          render: (v) => (
            <Badge variant={v === 'S' ? 'default' : 'secondary'}>{v === 'S' ? 'Activo' : 'Inactivo'}</Badge>
          ),
        },
      ]}
    />
  )
}
