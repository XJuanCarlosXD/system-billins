import { createFileRoute } from '@tanstack/react-router'
import { SdnDefNominas } from '@/features/sdn/sdn-def-nominas'
export const Route = createFileRoute('/_authenticated/sdn/def-nominas')({ component: SdnDefNominas })
