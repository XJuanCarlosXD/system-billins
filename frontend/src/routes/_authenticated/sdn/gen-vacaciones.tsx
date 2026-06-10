import { createFileRoute } from '@tanstack/react-router'
import { SdnGenVacaciones } from '@/features/sdn/sdn-stubs'
export const Route = createFileRoute('/_authenticated/sdn/gen-vacaciones')({ component: SdnGenVacaciones })
