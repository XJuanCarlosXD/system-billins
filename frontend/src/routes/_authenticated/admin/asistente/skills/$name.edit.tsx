import { createFileRoute } from '@tanstack/react-router'
import { AsistenteAdminSkillEditPage } from '@/features/asistente/admin-skill-edit-page'

export const Route = createFileRoute(
  '/_authenticated/admin/asistente/skills/$name/edit',
)({
  component: AsistenteAdminSkillEditPage,
})
