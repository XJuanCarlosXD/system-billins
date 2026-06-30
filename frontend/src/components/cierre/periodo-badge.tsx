import { Badge } from '@/components/ui/badge'
import { Calendar } from 'lucide-react'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

interface Props {
  mes?: number | null
  ano?: number | null
  loading?: boolean
}

export function PeriodoBadge({ mes, ano, loading }: Props) {
  if (loading)
    return (
      <Badge variant='outline' className='text-xs animate-pulse'>
        Cargando…
      </Badge>
    )
  if (!mes || !ano) return null
  return (
    <Badge variant='outline' className='text-xs'>
      <Calendar className='h-3 w-3 mr-1' />
      Periodo activo:{' '}
      <span className='font-semibold ml-1'>
        {MESES[mes - 1]} {ano}
      </span>
    </Badge>
  )
}
