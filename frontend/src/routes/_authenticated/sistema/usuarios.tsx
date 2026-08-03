import { createFileRoute } from '@tanstack/react-router'
import { RequireAdmin } from '@/components/access'
import { UsersAdminPage } from '@/features/auth-mgmt/users-admin'

export const Route = createFileRoute('/_authenticated/sistema/usuarios')({
  component: GuardedUsersAdminPage,
})

function GuardedUsersAdminPage() {
  return (
    <RequireAdmin>
      <UsersAdminPage />
    </RequireAdmin>
  )
}
