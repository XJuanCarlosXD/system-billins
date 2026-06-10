import { EmptySection } from '@/features/_shared/empty-section'

export const AccNuevoEgreso = () => (
  <EmptySection
    title="Entrada de Egreso (Pago de Caja Chica)"
    description="Usa por ahora la opción Consultas → Documentos / Egresos → Nuevo Egreso. El formulario dedicado con búsqueda de beneficiario y validación NCF se entrega en el próximo sprint. Backend listo en POST /api/acc/documentos/crear/."
  />
)

export const AccReposicion = () => (
  <EmptySection
    title="Reposición de Caja"
    description="Proceso de reposición pendiente de UI. Backend disponible para listar reposiciones en GET /api/acc/reposiciones/."
  />
)

export const AccAnular = () => (
  <EmptySection
    title="Anular Egreso"
    description="Por ahora puedes anular desde el modal de detalle en Consultas → Documentos / Egresos. Backend: POST /api/acc/documentos/anular/."
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
