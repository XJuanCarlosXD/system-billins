import { createFileRoute } from '@tanstack/react-router'
import { CxpMovimientos } from '@/features/cxp/movimientos'

// Antes renderizaba CxpRepMovimientos (RCXP103), una segunda implementación
// más vieja y básica del mismo reporte (sin picker de proveedor, sin
// paginación, sin sidesheet de documento) que /cxp/movimientos -- dos
// pantallas del sidebar ("Movimientos de Proveedor" y "Movimientos de
// Proveedores") apuntaban a componentes distintos con el mismo propósito.
// Unificado a una sola implementación para no mantener dos versiones.
export const Route = createFileRoute('/_authenticated/cxp/rep-movimientos')({
  component: CxpMovimientos,
})
