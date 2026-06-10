import { EmptySection } from '@/features/_shared/empty-section'

export const AcfCompra = () => (
  <EmptySection title="Compra de Activo Fijo" description="Registra un activo desde una factura de proveedor. Crea fila en TACF_ACTIVOS + TACF_DOCUMENTO + TACF_DCDOCU. Backend pendiente." />
)
export const AcfRetiro = () => (
  <EmptySection title="Retiro de Activo Fijo" description="Da de baja un activo (venta, donación, dejarlo de usar). Calcula ganancia/pérdida vs valor en libros." />
)
export const AcfDepreciacion = () => (
  <EmptySection title="Depreciación Mensual" description="Aplica depreciación según método configurado en TACF_PUNTO.METODO_DEPRE. Genera asiento contable." />
)
export const AcfCierre = () => (
  <EmptySection title="Cierre Mensual ACF" description="Avanza TACF_PUNTO.MES_PROCESO. Requiere que la depreciación del mes ya esté aplicada." />
)
export const AcfReportes = () => (
  <EmptySection title="Reportes" description="Resumen y conteo por grupo disponibles vía /api/acf/rep-resumen/ y /api/acf/rep-por-grupo/. Vista detallada en construcción; usa Activos para ver el listado actual." />
)
