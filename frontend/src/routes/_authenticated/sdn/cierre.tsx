import { createFileRoute } from '@tanstack/react-router'
import { SdnCierre } from '@/features/sdn/sdn-cierre'
export const Route = createFileRoute('/_authenticated/sdn/cierre')({ component: SdnCierre })
