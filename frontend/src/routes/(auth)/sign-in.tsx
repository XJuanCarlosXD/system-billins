import { z } from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { SignIn } from '@/features/auth/sign-in'
import { regalGeneralApi } from '@/lib/regal-general-api'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/sign-in')({
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    // Si ya hay sesion activa, mandalo directo al destino o al dashboard.
    let authed = false
    try {
      const me = await regalGeneralApi.me()
      authed = Boolean(me?.is_authenticated)
    } catch {
      authed = false
    }
    if (authed) {
      throw redirect({ to: (search.redirect as string) || '/' })
    }
  },
  component: SignIn,
})
