import { api } from '@/lib/regal-general-api'
import { CatalogCrud } from '@/components/catalog/catalog-crud'
import { Badge } from '@/components/ui/badge'

export function AccTiposBene() {
  return (
    <CatalogCrud
      title="Tipos de Beneficiario"
      description="Categorización de personas/entidades que reciben egresos."
      queryKey={['acc-tbene']}
      fetchList={() => api.accListTiposBene()}
      createFn={(d) => api.accSaveTipoBene(d)}
      updateFn={(_row, d) => api.accSaveTipoBene(d)}
      deleteFn={(row) => api.accDeleteTipoBene(row.tipo_bene)}
      pkLabel={(r) => r.tipo_bene}
      maxWidth="2xl"
      fields={[
        { key: 'tipo_bene', label: 'Tipo', isPk: true, required: true, uppercase: true, maxLength: 4, colClass: 'font-mono' },
        { key: 'descripcion', label: 'Descripción', required: true, colClass: '' },
        {
          key: 'activo', label: 'Activo', type: 'select', defaultValue: 'S',
          options: [{ value: 'S', label: 'Sí' }, { value: 'N', label: 'No' }],
          render: (v) => <Badge variant={v === 'S' ? 'default' : 'secondary'}>{v === 'S' ? 'Sí' : 'No'}</Badge>,
        },
      ]}
    />
  )
}
