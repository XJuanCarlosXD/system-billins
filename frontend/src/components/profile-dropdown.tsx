import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import useDialogState from '@/hooks/use-dialog-state'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SignOutDialog } from '@/components/sign-out-dialog'
import { apiClient, type Me } from '@/lib/api-client'

export function ProfileDropdown() {
  const [open, setOpen] = useDialogState()
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    apiClient.me().then(setMe).catch(() => setMe(null))
  }, [])

  const initials = me?.full_name
    ? me.full_name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : (me?.username ?? '??').slice(0, 2).toUpperCase()

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='relative h-8 w-8 rounded-full'>
            <Avatar className='h-8 w-8'>
              <AvatarImage src='/avatars/01.png' alt={me?.username ?? ''} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-56' align='end' forceMount>
          <DropdownMenuLabel className='font-normal'>
            <div className='flex flex-col gap-1.5'>
              <p className='text-sm leading-none font-medium'>
                {me?.full_name || me?.username || 'Cargando…'}
              </p>
              <p className='text-xs leading-none text-muted-foreground'>
                {me?.role || (me?.is_admin ? 'Administrador' : 'Usuario')}
              </p>
              {me?.full_name && (
                <p className='text-[10px] leading-none text-muted-foreground font-mono'>{me.username}</p>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link to='/cambiar-clave'>Cambiar contraseña</Link>
            </DropdownMenuItem>
            {me?.is_admin && (
              <DropdownMenuItem asChild>
                <Link to='/sistema/usuarios'>Administrar usuarios</Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link to='/settings'>Configuración</Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant='destructive' onClick={() => setOpen(true)}>
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
