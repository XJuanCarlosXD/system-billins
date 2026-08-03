import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { History, RefreshCw, ShieldCheck } from 'lucide-react'
import { apiClient, type Me } from '@/lib/api-client'
import { historialMio, type EventoHistorial } from '@/lib/api-client-historial'
import { HistorialTimeline } from '@/features/historial/historial-timeline'
import { ModuleLauncher } from './components/module-launcher'

export function Dashboard() {
  const [me, setMe] = useState<Me | null>(null)
  const [miActividad, setMiActividad] = useState<EventoHistorial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [meRes, historialRes] = await Promise.all([
        apiClient.me(),
        historialMio(8).catch(() => ({ items: [] })),
      ])
      setMe(meRes)
      setMiActividad(historialRes.items)
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <>
      <Header>
        <h2 className='text-lg font-semibold me-auto'>Dashboard</h2>
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main>
        <div className='mb-4 flex items-center justify-between'>
          <div>
            <h1 className='flex items-center gap-2 text-2xl font-bold tracking-tight'>
              Bienvenido{me ? `, ${me.full_name || me.username}` : ''}
              {me?.is_admin ? (
                <Badge className='gap-1 align-middle'>
                  <ShieldCheck className='h-3 w-3' />
                  Administrador
                </Badge>
              ) : me?.role ? (
                <Badge variant='secondary' className='align-middle'>{me.role}</Badge>
              ) : me ? (
                <Badge variant='secondary' className='align-middle'>Usuario</Badge>
              ) : null}
            </h1>
            <p className='text-sm text-muted-foreground'>
              Selecciona un módulo para comenzar o revisa tu actividad reciente.
            </p>
          </div>
          <Button variant='outline' onClick={load} disabled={loading}>
            <RefreshCw className={`me-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refrescar
          </Button>
        </div>

        {error && (
          <Card className='mb-4 border-red-300 bg-red-50 dark:bg-red-950'>
            <CardContent className='py-3 text-sm text-red-700 dark:text-red-200'>
              {error}
            </CardContent>
          </Card>
        )}

        <div className='mb-4'>
          <ModuleLauncher />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <History className='h-5 w-5' />
              Mi actividad reciente
            </CardTitle>
            <CardDescription>
              Tus últimas acciones registradas en el sistema (crear, editar, anular).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className='h-32 w-full' />
            ) : (
              <HistorialTimeline eventos={miActividad} modo='compacto' />
            )}
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
