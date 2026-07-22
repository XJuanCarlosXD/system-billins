import { useState } from 'react'
import { LifeBuoy, Plus } from 'lucide-react'
import { useAccess } from '@/hooks/use-access'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { ReportesAdminTable } from './reportes-admin-table'
import { MisReportes, SoporteDialog } from './soporte-dialog'

export function ReportesPage() {
  const { isAdmin } = useAccess()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Header>
        <h2 className='me-auto flex items-center gap-2 text-lg font-semibold'>
          <LifeBuoy className='h-5 w-5' /> Reportes de Problemas
        </h2>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main>
        <div className='mb-4 flex items-center justify-between gap-2'>
          <p className='text-muted-foreground text-sm'>
            {isAdmin
              ? 'Todos los reportes enviados por los usuarios. Cambia el estado y deja una nota de resolución.'
              : 'Reporta un problema del sistema con imágenes, y sigue el estado de lo que ya reportaste.'}
          </p>
          <Button onClick={() => setOpen(true)}>
            <Plus className='size-4' /> Reportar problema
          </Button>
        </div>

        {isAdmin ? <ReportesAdminTable /> : <MisReportes />}
      </Main>
      <SoporteDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
