import { createFileRoute } from '@tanstack/react-router'
import { ChcBancos } from '@/features/chc/chc-bancos'

export const Route = createFileRoute('/_authenticated/chc/bancos')({
  component: ChcBancos,
})
