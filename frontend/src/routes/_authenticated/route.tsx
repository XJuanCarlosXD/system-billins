import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { regalGeneralApi } from '@/lib/regal-general-api'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    let authed = false
    try {
      const me = await regalGeneralApi.me()
      authed = Boolean(me?.is_authenticated)
    } catch {
      authed = false
    }
    if (!authed) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href },
      })
    }
  },
  component: AuthenticatedLayout,
})
