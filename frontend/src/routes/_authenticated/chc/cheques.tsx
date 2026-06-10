import { createFileRoute } from '@tanstack/react-router'
import { ChcCheques } from '@/features/chc/chc-cheques'

export const Route = createFileRoute('/_authenticated/chc/cheques')({
  component: ChcCheques,
})
