import { createFileRoute } from '@tanstack/react-router'
import { FatPage } from '@/features/fat'

export const Route = createFileRoute('/_authenticated/fat')({
  component: FatPage,
})
