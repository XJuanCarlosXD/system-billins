import { createFileRoute } from '@tanstack/react-router'
import { SdnCias } from '@/features/sdn/sdn-simple-tables'
export const Route = createFileRoute('/_authenticated/sdn/cias')({ component: SdnCias })
