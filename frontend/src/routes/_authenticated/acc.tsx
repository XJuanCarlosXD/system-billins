import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Coins } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { RequireModule } from '@/components/access'

export const Route = createFileRoute('/_authenticated/acc')({
  component: AccLayout,
})

function AccLayout() {
  return (
    <RequireModule modulo="acc">
      <Header>
        <div className="me-auto flex items-center gap-2">
          <Coins className="h-5 w-5 shrink-0" />
          <h2 className="text-lg font-semibold">Caja Chica (ACC)</h2>
        </div>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main>
        <Outlet />
      </Main>
    </RequireModule>
  )
}
