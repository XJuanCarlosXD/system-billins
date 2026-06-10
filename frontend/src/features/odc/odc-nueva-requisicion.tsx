import { EmptySection } from '@/features/_shared/empty-section'

export function OdcNuevaRequisicion() {
  return (
    <EmptySection
      title="Entrada de Requisición Interna"
      description="Formulario en construcción. Backend disponible: POST /api/odc/requisiciones/crear/. Puedes usar Consultas → Requisiciones para autorizar (slot 1/2/3), cerrar o anular requisiciones existentes."
    />
  )
}
