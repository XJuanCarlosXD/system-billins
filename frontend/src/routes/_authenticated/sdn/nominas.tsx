import { createFileRoute } from '@tanstack/react-router'
import { SdnNominas } from '@/features/sdn/sdn-nominas'

export const Route = createFileRoute('/_authenticated/sdn/nominas')({
  component: SdnNominas,
})
