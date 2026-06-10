import { EmptySection } from '@/features/_shared/empty-section'

export const ChcSolicitar = () => (
  <EmptySection title="Solicitar Cheque" description="Formulario en construcción. Backend listo: el cheque crea un registro en TCHC_CHEQUE con status='P' (Pendiente)." />
)
export const ChcImprimir = () => (
  <EmptySection title="Imprimir Cheques" description="Cola de impresión. Una vez impresos, los cheques quedan con st_impresion='S'." />
)
export const ChcEntregar = () => (
  <EmptySection title="Entregar Cheques" description="Por ahora puedes entregar uno a uno desde Consultas → Cheques. Backend: POST /api/chc/cheques/entregar/." />
)
export const ChcConciliar = () => (
  <EmptySection title="Conciliación Bancaria" description="Marcado individual disponible en Consultas → Cheques. La importación de estados de cuenta del banco se entrega en el sprint de DGII bancos." />
)
export const ChcAnular = () => (
  <EmptySection title="Anular Cheque" description="Use Consultas → Cheques para anular un cheque individual con motivo. Backend: POST /api/chc/cheques/anular/." />
)

export const ChcRepMovimientos = () => (
  <EmptySection title="Movimiento de Cuenta (Rchc501)" description="Movimientos de una cuenta para un mes. Backend de detalle pendiente; usa Saldos para resumen rápido." />
)
export const ChcRepDiario = () => (
  <EmptySection title="Libro Diario de Cheques (rchc218)" description="Listado diario débitos/créditos para mayor general. UI en construcción." />
)
export const ChcRepDisponibilidad = () => (
  <EmptySection title="Disponibilidad Bancaria (Rchc505)" description="Saldo disponible neto descontando cheques por entregar. Aprox. disponible en Saldos por ahora." />
)
