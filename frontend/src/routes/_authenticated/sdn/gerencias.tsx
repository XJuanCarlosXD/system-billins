import { createFileRoute } from '@tanstack/react-router'
import { SdnGerencias } from '@/features/sdn/sdn-simple-tables'
export const Route = createFileRoute('/_authenticated/sdn/gerencias')({ component: SdnGerencias })
