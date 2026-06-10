import { createFileRoute } from '@tanstack/react-router'
import { ChcCierres } from '@/features/chc/chc-cierres'

export const Route = createFileRoute('/_authenticated/chc/cierres')({
  component: ChcCierres,
})
