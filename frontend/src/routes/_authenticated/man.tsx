import { createFileRoute } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Search } from '@/components/search'
import { ManManuales } from '@/features/man/man-manuales'

export const Route = createFileRoute('/_authenticated/man')({
  component: ManPage,
})

function ManPage() {
  return (
    <>
      <Header>
        <div className="me-auto flex items-center gap-2">
          <BookOpen className="h-5 w-5 shrink-0" />
          <h2 className="text-lg font-semibold">Manuales (MAN)</h2>
        </div>
        <Search placeholder="Buscar..." className="w-40 lg:w-52" />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main>
        <ManManuales />
      </Main>
    </>
  )
}
