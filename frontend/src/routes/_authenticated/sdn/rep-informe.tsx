import { createFileRoute } from '@tanstack/react-router'
import { SdnRepInforme } from '@/features/sdn/sdn-rep-informe'
export const Route = createFileRoute('/_authenticated/sdn/rep-informe')({ component: SdnRepInforme })
