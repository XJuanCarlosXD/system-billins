import { EmptySection } from '@/features/_shared/empty-section'

export const AccReposicion = () => (
  <EmptySection
    title="Reposición de Caja"
    description="Proceso de reposición pendiente de UI. Backend disponible para listar reposiciones en GET /api/acc/reposiciones/."
  />
)

export const AccAsiento = () => (
  <EmptySection
    title="Imprimir Asiento Contable de Caja Chica"
    description="Vista en construcción. La generación de asiento usará TACC_DCDOCU agrupado por mes/cuenta."
  />
)

export const AccCierre = () => (
  <EmptySection
    title="Cierre Mensual ACC"
    description="Cierra el mes en TACC_PUNTO. Pendiente de UI; requiere autorización y validación de saldos."
  />
)
