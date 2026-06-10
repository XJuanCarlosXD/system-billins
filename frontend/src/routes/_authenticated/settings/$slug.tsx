import { createFileRoute } from '@tanstack/react-router'
import { SettingsHub } from '@/features/settings/settings-hub'

type SettingsSearch = {
  q?: string
}

export const Route = createFileRoute('/_authenticated/settings/$slug')({
  component: SettingsHub,
  validateSearch: (search: Record<string, unknown>): SettingsSearch => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
})
