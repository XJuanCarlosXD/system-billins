import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Wallet } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Search } from '@/components/search'

export const Route = createFileRoute('/_authenticated/cxp')({
  component: CxpLayout,
})

function CxpLayout() {
  return (
    <>
      <Header>
        <div className="me-auto flex items-center gap-2">
          <Wallet className="h-5 w-5 shrink-0" />
          <h2 className="text-lg font-semibold">Cuentas por Pagar (CXP)</h2>
        </div>
        <Search placeholder="Buscar pantalla..." className="w-40 lg:w-52" />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main>
        <Outlet />
      </Main>
    </>
  )
}
