import { useMe } from '@/hooks/use-me'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ShieldCheck, User, Building2, LayoutGrid } from 'lucide-react'

export function ProfileForm() {
  const { data: me, isLoading, isError } = useMe()

  if (isLoading) {
    return (
      <div className='space-y-3'>
        <Skeleton className='h-20 w-full' />
        <Skeleton className='h-32 w-full' />
      </div>
    )
  }

  if (isError || !me) {
    return (
      <div className='rounded border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
        No se pudo cargar el perfil del usuario.
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <User className='h-4 w-4' /> Identidad
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-2 text-sm'>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground'>Usuario</span>
            <span className='font-mono font-medium'>{me.username}</span>
          </div>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground'>Rol</span>
            {me.is_admin ? (
              <Badge className='gap-1'>
                <ShieldCheck className='h-3 w-3' />
                Administrador
              </Badge>
            ) : (
              <Badge variant='secondary'>Usuario</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Building2 className='h-4 w-4' />
            Empresas autorizadas
            <Badge variant='outline'>{me.companies.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {me.companies.length === 0 ? (
            <p className='text-sm text-muted-foreground'>Sin empresas asignadas.</p>
          ) : (
            <ul className='space-y-1 text-sm'>
              {me.companies.map((c: any) => (
                <li
                  key={c.no_cia}
                  className='flex items-center justify-between rounded border px-2 py-1.5'
                >
                  <span className='font-medium'>{c.descripcion ?? c.no_cia}</span>
                  <span className='font-mono text-xs text-muted-foreground'>{c.no_cia}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <LayoutGrid className='h-4 w-4' />
            Módulos con acceso
            <Badge variant='outline'>{me.modules.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {me.modules.length === 0 ? (
            <p className='text-sm text-muted-foreground'>Sin módulos asignados.</p>
          ) : (
            <div className='flex flex-wrap gap-1.5'>
              {[...new Set(me.modules.map((m: any) => m.modulo))].map((mod: any) => (
                <Badge key={mod} variant='secondary' className='uppercase'>
                  {mod}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className='text-xs text-muted-foreground'>
        Para modificar empresas, puntos o módulos asignados, contacta al administrador.
      </p>
    </div>
  )
}
