import { createFileRoute } from '@tanstack/react-router'
import { SdnRepRnc } from '@/features/sdn/sdn-stubs'
export const Route = createFileRoute('/_authenticated/sdn/rep-rnc')({ component: SdnRepRnc })
