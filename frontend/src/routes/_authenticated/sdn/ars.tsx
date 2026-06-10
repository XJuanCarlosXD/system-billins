import { createFileRoute } from '@tanstack/react-router'
import { SdnArs } from '@/features/sdn/sdn-simple-tables'
export const Route = createFileRoute('/_authenticated/sdn/ars')({ component: SdnArs })
