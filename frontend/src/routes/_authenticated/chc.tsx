import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Banknote } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'

export const Route = createFileRoute('/_authenticated/chc')({
  component: ChcLayout,
})

function ChcLayout() {
  return (
    <>
      <Header>
        <div className="me-auto flex items-center gap-2">
          <Banknote className="h-5 w-5 shrink-0" />
          <h2 className="text-lg font-semibold">Bancos / Cheques (CHC)</h2>
        </div>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main>
        <Outlet />
      </Main>
    </>
  )
}
