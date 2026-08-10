import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { InvPage } from '@/features/inv'
import { RequireModule } from '@/components/access'

export const Route = createFileRoute('/_authenticated/inv')({
  validateSearch: z.object({
    section: z
      .enum(['configuracion', 'procesos', 'consultas', 'reportes', 'conteo-fisico', 'cierre'])
      .optional()
      .catch('configuracion'),
    view: z.string().optional().catch(undefined),
    tipo_docu: z.string().optional().catch(undefined),
    // Edición de un documento existente: "<tipo_docu>-<no_docu>" (ej. "EC-0001234").
    edit: z.string().optional().catch(undefined),
  }),
  component: GuardedInvPage,
})

function GuardedInvPage() {
  return (
    <RequireModule modulo="inv">
      <InvPage />
    </RequireModule>
  )
}
