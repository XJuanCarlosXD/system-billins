import { createFileRoute } from '@tanstack/react-router'
import { UsersAdminPage } from '@/features/auth-mgmt/users-admin'

export const Route = createFileRoute('/_authenticated/sistema/usuarios')({
  component: UsersAdminPage,
})
