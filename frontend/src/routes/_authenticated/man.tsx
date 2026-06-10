import { createFileRoute } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ManManuales } from '@/features/man/man-manuales'

export const Route = createFileRoute('/_authenticated/man')({
  component: ManPage,
})

function ManPage() {
  return (
    <>
      <Header>
        <div className='me-auto flex items-center gap-2'>
          <BookOpen className='h-5 w-5 shrink-0' />
          <h2 className='text-lg font-semibold'>Manuales</h2>
        </div>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main>
        <ManManuales />
      </Main>
    </>
  )
}
