import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { CntPage } from '@/features/cnt'
import { RequireModule } from '@/components/access'

export const Route = createFileRoute('/_authenticated/cnt')({
  validateSearch: z.object({
    section: z
      .enum(['configuracion', 'procesos', 'consultas', 'reportes', 'cierres'])
      .optional()
      .catch('reportes'),
    view: z.string().optional().catch(undefined),
  }),
  component: GuardedCntPage,
})

function GuardedCntPage() {
  return (
    <RequireModule modulo="cnt">
      <CntPage />
    </RequireModule>
  )
}
