import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { CntPage } from '@/features/cnt'

export const Route = createFileRoute('/_authenticated/cnt')({
  validateSearch: z.object({
    section: z
      .enum(['configuracion', 'procesos', 'consultas', 'reportes', 'cierres'])
      .optional()
      .catch('reportes'),
    view: z.string().optional().catch(undefined),
  }),
  component: CntPage,
})
