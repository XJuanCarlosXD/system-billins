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
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Receipt,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react'
import { sigafApi, type Me, type NCFAlert } from '@/lib/sigaf-api'

function severityClass(s: 'critical' | 'warning' | 'ok') {
  if (s === 'critical') return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-200'
  if (s === 'warning') return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200'
  return 'bg-emerald-100 text-emerald-800 border-emerald-300'
}

export function Dashboard() {
  const [me, setMe] = useState<Me | null>(null)
  const [alerts, setAlerts] = useState<NCFAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [meRes, alertsRes] = await Promise.all([
        sigafApi.me(),
        sigafApi.fatNcfAlerts('low'),
      ])
      setMe(meRes)
      setAlerts(alertsRes.alerts)
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const empresasActivas = me?.companies?.filter((c) => c.activa) ?? []
  const modulosConAcceso = (me?.modules ?? []).filter((m) => m.activo)
  const modulosUnicos = new Set(modulosConAcceso.map((m) => m.modulo))
  const criticas = alerts.filter((a) => a.severity === 'critical').length
  const warnings = alerts.filter((a) => a.severity === 'warning').length

  return (
    <>
      <Header>
        <h2 className='text-lg font-semibold me-auto'>Dashboard SIGAFPLUS</h2>
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main>
        <div className='mb-4 flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>
              Bienvenido{me ? `, ${me.username}` : ''}
            </h1>
            <p className='text-sm text-muted-foreground'>
              Datos en tiempo real desde Oracle 11g (legacy SIGAFPLUS).
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

        {/* KPIs */}
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Empresas activas</CardTitle>
              <Building2 className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className='h-8 w-12' />
              ) : (
                <>
                  <div className='text-2xl font-bold'>{empresasActivas.length}</div>
                  <p className='text-xs text-muted-foreground'>
                    {empresasActivas.map((c) => c.no_cia).join(' · ')}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Módulos con acceso</CardTitle>
              <ShieldCheck className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className='h-8 w-12' />
              ) : (
                <>
                  <div className='text-2xl font-bold'>{modulosUnicos.size}</div>
                  <p className='text-xs text-muted-foreground uppercase'>
                    {[...modulosUnicos].join(' · ') || 'sin asignaciones'}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>NCF críticos</CardTitle>
              <AlertTriangle className='h-4 w-4 text-red-500' />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className='h-8 w-12' />
              ) : (
                <>
                  <div className='text-2xl font-bold text-red-600'>{criticas}</div>
                  <p className='text-xs text-muted-foreground'>≤25% del rango disponible</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>NCF en aviso</CardTitle>
              <AlertTriangle className='h-4 w-4 text-amber-500' />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className='h-8 w-12' />
              ) : (
                <>
                  <div className='text-2xl font-bold text-amber-600'>{warnings}</div>
                  <p className='text-xs text-muted-foreground'>≤ mínimo configurado</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alertas NCF */}
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
          <Card className='lg:col-span-1'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <AlertTriangle className='h-5 w-5 text-amber-500' />
                Alertas NCF
              </CardTitle>
              <CardDescription>
                Rangos cerca del agotamiento — pedir nuevos NCF a la DGII.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-2'>
              {loading ? (
                <>
                  <Skeleton className='h-12 w-full' />
                  <Skeleton className='h-12 w-full' />
                  <Skeleton className='h-12 w-full' />
                </>
              ) : alerts.length === 0 ? (
                <div className='flex items-center gap-2 text-emerald-700 dark:text-emerald-300'>
                  <CheckCircle2 className='h-4 w-4' />
                  Todos los NCF están sobre el umbral.
                </div>
              ) : (
                alerts.map((a) => (
                  <div
                    key={`${a.no_cia}-${a.codigo_ncf}`}
                    className={`flex items-center justify-between rounded border px-3 py-2 ${severityClass(a.severity)}`}
                  >
                    <div>
                      <div className='font-mono text-sm font-semibold'>
                        {a.codigo_ncf}{' '}
                        <span className='text-xs opacity-70'>
                          (Empresa {a.no_cia})
                        </span>
                      </div>
                      <div className='text-xs opacity-80 truncate max-w-[280px]'>
                        {a.empresa ?? '—'}
                      </div>
                    </div>
                    <div className='text-right'>
                      <div className='text-sm font-semibold'>
                        {a.disponibles} / {a.ncf_final - a.ncf_inicial + 1}
                      </div>
                      <div className='text-xs opacity-70'>
                        próx {a.prox_ncf} · min {a.cant_min_ncf}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Empresas */}
          <Card className='lg:col-span-1'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Building2 className='h-5 w-5' />
                Empresas
              </CardTitle>
              <CardDescription>Multi-empresa configurada en el legado.</CardDescription>
            </CardHeader>
            <CardContent className='space-y-2'>
              {loading ? (
                <>
                  <Skeleton className='h-10 w-full' />
                  <Skeleton className='h-10 w-full' />
                </>
              ) : (
                empresasActivas.map((c) => (
                  <div
                    key={c.no_cia}
                    className='flex items-center justify-between rounded border px-3 py-2 hover:bg-muted/50'
                  >
                    <div>
                      <div className='font-medium'>
                        <span className='font-mono text-xs me-2 text-muted-foreground'>
                          {c.no_cia}
                        </span>
                        {c.descripcion}
                      </div>
                      <div className='text-xs text-muted-foreground'>RNC {c.rnc}</div>
                    </div>
                    <Badge variant={c.activa ? 'default' : 'secondary'}>
                      {c.activa ? 'activa' : 'inactiva'}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Mis accesos */}
        <Card className='mt-4'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Receipt className='h-5 w-5' />
              Mis accesos por módulo y empresa
            </CardTitle>
            <CardDescription>
              Acceso (NO_CIA + PUNTO) leído de TXXX_USUARIO en cada módulo activo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className='h-32 w-full' />
            ) : modulosConAcceso.length === 0 ? (
              <div className='text-sm text-muted-foreground'>
                Sin asignaciones activas.
              </div>
            ) : (
              <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2'>
                {modulosConAcceso.map((m) => (
                  <div
                    key={`${m.modulo}-${m.no_cia}-${m.punto}`}
                    className={`rounded border px-3 py-2 text-sm ${m.por_defecto ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <div className='font-mono uppercase font-semibold'>
                      {m.modulo}
                    </div>
                    <div className='text-xs text-muted-foreground'>
                      Cía {m.no_cia} · Pto {m.punto}
                      {m.por_defecto && ' · default'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
