import { Button, type ButtonProps } from '@/components/ui/button'
import { useAccess } from '@/hooks/use-access'
import { useCompany } from '@/hooks/use-company'

interface Props extends ButtonProps {
  modulo: string
  /** Gate by a S/N flag of TXXX_USUARIO (e.g. HACER_CIERRE). */
  flag?: string
  /** Gate by access to a tipo_docu of TXXX_USUARIOD (e.g. 'AF' en FAT = Anulacion Factura). */
  docType?: string
  /** Empresa/punto a validar. Por defecto usa la empresa/punto seleccionados globalmente
   *  (useCompany) — pasar explicito solo cuando la pantalla permite operar sobre un
   *  punto distinto al activo (p.ej. reversar un documento de otro punto). */
  noCia?: string
  punto?: string
  /** If true, keep the button visible but disabled instead of hiding it. */
  disableInsteadOfHide?: boolean
}

export function GuardedButton({
  modulo,
  flag,
  docType,
  noCia,
  punto,
  disableInsteadOfHide,
  children,
  ...rest
}: Props) {
  const { selectedCompany, selectedPoint } = useCompany()
  const { hasFlag, hasDocType } = useAccess()
  const cia = noCia ?? selectedCompany ?? ''
  const pt = punto ?? selectedPoint ?? ''
  const allowed = flag
    ? hasFlag(modulo, cia, pt, flag)
    : docType
      ? hasDocType(modulo, cia, pt, docType)
      : true
  if (!allowed && !disableInsteadOfHide) return null
  return (
    <Button {...rest} disabled={rest.disabled || !allowed}>
      {children}
    </Button>
  )
}
