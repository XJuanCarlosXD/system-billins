import { createFileRoute } from '@tanstack/react-router'
import { SdnDeduccionMasiva } from '@/features/sdn/sdn-deduccion-masiva'
export const Route = createFileRoute('/_authenticated/sdn/deduccion-masiva')({ component: SdnDeduccionMasiva })
