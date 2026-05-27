// Placeholder for CxP screens pending backend
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

const LABELS: Record<string, string> = {
  cias: 'FCXP101 - Mantenimiento de Companias',
  puntos: 'FCXP102 - Puntos de Trabajo / Sucursales',
  tproveedores: 'FCXP104 - Tipos de Proveedores',
  usuarios: 'FCXP103 - Acceso de Usuarios al Modulo',
  ciudades: 'FCXP111 - Mantenimiento de Ciudades',
  barrios: 'FCXP112 - Sectores o Barrios',
  'entrada-documentos': 'FCXP201 - Entrada de Documentos DR/CR',
  reversar: 'FCXP204 - Reversar Documento',
  'liberar-debito': 'FCXP205 - Liberar Debito',
  'bloquear-pago': 'FCXP206 - Bloquear/Desbloquear Pago a Factura',
  'rep-alfabetico': 'RCXP101 - Alfabetico de Proveedores',
  'rep-movimientos': 'RCXP103 - Movimientos de Proveedores',
  'rep-mayor': 'RCXP104 - Mayor Auxiliar Cuentas por Pagar',
  'rep-606': 'RCXP606 - ITBIS Compras Locales Formato 606',
  'rep-607': 'RCXP607 - Retenciones a Proveedores Formato 607',
  'rep-cuadre': 'RCXP105 - Reporte de Cuadre Contable',
  'rep-retenciones': 'RCXP108 - Certificado Retencion Proveedores',
  'asiento-contable': 'FCXP301 - Imprimir Asiento Contable',
  'generar-asiento': 'FCXP302 - Generar Asiento a Contabilidad',
  cierre: 'FCXP303 - Cierre Mensual',
}

interface P { title: string; noCia?: string; punto?: string }

export function CxpPlaceholder({ title, noCia }: P) {
  const label = LABELS[title] ?? title
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">{label}</h1>
      {noCia && <p className="text-sm text-muted-foreground">Compania: {noCia}</p>}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Pendiente de implementacion</AlertTitle>
        <AlertDescription>
          Esta pantalla requiere endpoints de backend que aun no estan disponibles.
          Sera implementada en la proxima iteracion del modulo CxP.
        </AlertDescription>
      </Alert>
    </div>
  )
}
