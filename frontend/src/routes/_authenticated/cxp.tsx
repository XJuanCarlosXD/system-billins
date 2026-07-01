import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Wallet } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { RequireModule } from '@/components/access'

export const Route = createFileRoute('/_authenticated/cxp')({
  component: CxpLayout,
})

function CxpLayout() {
  return (
    <RequireModule modulo="cxp">
      <Header>
        <div className="me-auto flex items-center gap-2">
          <Wallet className="h-5 w-5 shrink-0" />
          <h2 className="text-lg font-semibold">Cuentas por Pagar (CXP)</h2>
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
