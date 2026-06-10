import { createFileRoute } from '@tanstack/react-router'
import { SdnVolante } from '@/features/sdn/sdn-stubs'
export const Route = createFileRoute('/_authenticated/sdn/volante')({ component: SdnVolante })
