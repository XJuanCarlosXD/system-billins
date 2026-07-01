import { createFileRoute, Outlet } from '@tanstack/react-router'
import { ShoppingCart } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { RequireModule } from '@/components/access'

export const Route = createFileRoute('/_authenticated/odc')({
  component: OdcLayout,
})

function OdcLayout() {
  return (
    <RequireModule modulo="odc">
      <Header>
        <div className="me-auto flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 shrink-0" />
          <h2 className="text-lg font-semibold">Órdenes de Compra (ODC)</h2>
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
