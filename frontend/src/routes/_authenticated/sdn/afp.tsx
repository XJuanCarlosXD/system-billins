import { createFileRoute } from '@tanstack/react-router'
import { SdnAfp } from '@/features/sdn/sdn-simple-tables'
export const Route = createFileRoute('/_authenticated/sdn/afp')({ component: SdnAfp })
