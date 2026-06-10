import { EmptySection } from '@/features/_shared/empty-section'

export const SdnDefNominas = () => (
  <EmptySection title="Definir Nóminas" description="Mantenimiento de TSDN_NOMINA: nombre, forma de pago, período, cuenta contable y bancaria. Vista en construcción; backend de consulta disponible en GET /api/sdn/nominas/." />
)
export const SdnMovimientos = () => (
  <EmptySection title="Movimientos Manuales de Nómina" description="Entrada de ingresos/deducciones individuales por empleado y nómina. Backend pendiente; estructura legacy: Fsdn204 (movimientos manuales) y Fsdn205 (mantenimiento egresos)." />
)
export const SdnCalcular = () => (
  <EmptySection title="Calcular Nómina" description="Procesa cálculo de ingresos/deducciones según conceptos y configuración. Marca TSDN_NOMINA.CALCULO_NOMINA='S'. Backend pendiente." />
)
export const SdnGenVacaciones = () => (
  <EmptySection title="Generar Vacaciones" description="Genera registros en TSDN_VACACIONES por empleados con derecho según escala (Fsdn401). Vista en construcción." />
)
export const SdnGenCheques = () => (
  <EmptySection title="Generar Solicitud de Cheques" description="Crea solicitudes TCHC_CHEQUE para el pago de nómina con la secuencia respectiva (Fsdn409)." />
)
export const SdnVolante = () => (
  <EmptySection title="Volante / Pre-Nómina" description="Previsualización del cálculo antes de cerrar. Permite revisar conceptos por empleado." />
)
export const SdnRepInforme = () => (
  <EmptySection title="Informe de Nómina (Fsdn207)" description="Reporte agregado por área/gerencia/departamento. Backend de consulta disponible." />
)
export const SdnRepRnc = () => (
  <EmptySection title="RNC Empleados" description="Listado para reportes DGII (TSS, AFP, ISR). Pendiente de implementar." />
)
