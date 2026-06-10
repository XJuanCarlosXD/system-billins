import { createFileRoute } from '@tanstack/react-router'
import { SdnDeptos } from '@/features/sdn/sdn-simple-tables'
export const Route = createFileRoute('/_authenticated/sdn/deptos')({ component: SdnDeptos })
