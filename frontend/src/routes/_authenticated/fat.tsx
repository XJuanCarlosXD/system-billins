import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Receipt } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { RequireModule } from '@/components/access'

// FAT usa rutas por archivo (routes/_authenticated/fat/*). Este padre es solo
// el shell: header + contenedor full width + <Outlet/> para la ruta hija.
// La navegacion la controla el sidebar (cada item apunta a /fat/<vista>).
export const Route = createFileRoute('/_authenticated/fat')({
  component: FatLayout,
})

function FatLayout() {
  return (
    <RequireModule modulo="fat">
      <Header>
        <div className='me-auto flex items-center gap-2'>
          <Receipt className='h-5 w-5 shrink-0' />
          <h2 className='text-lg font-semibold'>Facturacion (FAT)</h2>
        </div>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main fluid className='px-4 py-4'>
        <Outlet />
      </Main>
    </RequireModule>
  )
}
