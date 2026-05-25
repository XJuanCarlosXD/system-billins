import { EntradaMercancia } from './entrada-mercancia'

interface Props { noCia: string; punto: string }

export function SalidaMercancia({ noCia, punto }: Props) {
  return <EntradaMercancia noCia={noCia} punto={punto} tipoMov='salida' />
}
