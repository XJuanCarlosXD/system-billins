import { EmptySection } from '@/features/_shared/empty-section'

export function OdcNuevaOrden() {
  return (
    <EmptySection
      title="Entrada de Orden de Compra"
      description="El formulario completo de entrada de orden con captura de líneas, búsqueda de productos y proveedor se entrega en el siguiente sprint. El backend ya está disponible: POST /api/odc/ordenes/crear/. Mientras tanto puedes usar Consultas → Órdenes para ver, autorizar o anular órdenes existentes."
    />
  )
}
