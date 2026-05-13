import { createFileRoute } from '@tanstack/react-router'
import { ChangePasswordPage } from '@/features/auth-mgmt/change-password'

export const Route = createFileRoute('/_authenticated/cambiar-clave')({
  component: ChangePasswordPage,
})
