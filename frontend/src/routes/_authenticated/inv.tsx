import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { InvPage } from '@/features/inv'

export const Route = createFileRoute('/_authenticated/inv')({
  validateSearch: z.object({
    section: z
      .enum(['configuracion', 'procesos', 'consultas', 'reportes', 'conteo-fisico', 'cierre'])
      .optional()
      .catch('configuracion'),
    view: z.string().optional().catch(undefined),
  }),
  component: InvPage,
})
