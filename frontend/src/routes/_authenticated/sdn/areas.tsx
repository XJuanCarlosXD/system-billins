import { createFileRoute } from '@tanstack/react-router'
import { SdnAreas } from '@/features/sdn/sdn-simple-tables'
export const Route = createFileRoute('/_authenticated/sdn/areas')({ component: SdnAreas })
