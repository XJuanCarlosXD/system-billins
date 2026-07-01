import { Button, type ButtonProps } from '@/components/ui/button'
import { useAccess } from '@/hooks/use-access'
import { useCompany } from '@/hooks/use-company'

interface Props extends ButtonProps {
  modulo: string
  flag: string
  /** If true, keep the button visible but disabled instead of hiding it. */
  disableInsteadOfHide?: boolean
}

export function GuardedButton({
  modulo,
  flag,
  disableInsteadOfHide,
  children,
  ...rest
}: Props) {
  const { selectedCompany, selectedPoint } = useCompany()
  const { hasFlag } = useAccess()
  const allowed = hasFlag(modulo, selectedCompany ?? '', selectedPoint ?? '', flag)
  if (!allowed && !disableInsteadOfHide) return null
  return (
    <Button {...rest} disabled={rest.disabled || !allowed}>
      {children}
    </Button>
  )
}
