import { createFileRoute } from '@tanstack/react-router'
import { InvModule } from '@/features/inv'

export const Route = createFileRoute('/_authenticated/inv/')({
  component: InvModule,
})
