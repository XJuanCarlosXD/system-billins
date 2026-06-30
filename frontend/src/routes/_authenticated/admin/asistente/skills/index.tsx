import { createFileRoute } from '@tanstack/react-router'
import { AsistenteAdminSkillsPage } from '@/features/asistente/admin-skills-page'

export const Route = createFileRoute(
  '/_authenticated/admin/asistente/skills/',
)({
  component: AsistenteAdminSkillsPage,
})
