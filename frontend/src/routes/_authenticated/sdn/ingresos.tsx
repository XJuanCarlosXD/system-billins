import { createFileRoute } from '@tanstack/react-router'
import { SdnIngresos } from '@/features/sdn/sdn-simple-tables'
export const Route = createFileRoute('/_authenticated/sdn/ingresos')({ component: SdnIngresos })
