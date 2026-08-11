import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertTriangle, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { apiClient, type NCFAlert } from '@/lib/api-client'

type SeverityFilter = 'all' | 'critical' | 'warning'

const SEV_META: Record<
  NCFAlert['severity'],
  { label: string; variant: 'destructive' | 'default' | 'secondary' }
> = {
  critical: { label: 'Crítico', variant: 'destructive' },
  warning: { label: 'Por agotarse', variant: 'default' },
  ok: { label: 'OK', variant: 'secondary' },
}

export function NcfAlertsPage() {
  const [search, setSearch] = useState('')
  const [sev, setSev] = useState<SeverityFilter>('all')

  const query = useQuery({
    queryKey: ['ncf-alerts', 'all'],
    // Traemos todos los rangos y filtramos por severidad en el cliente.
    queryFn: () => apiClient.fatNcfAlerts('all'),
    staleTime: 60_000,
  })

  const alerts = useMemo(() => query.data?.alerts ?? [], [query.data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return alerts.filter((a) => {
      if (sev !== 'all' && a.severity !== sev) return false
      if (!q) return true
      return (
        (a.empresa ?? '').toLowerCase().includes(q) ||
        (a.descripcion ?? '').toLowerCase().includes(q) ||
        a.codigo_ncf.toLowerCase().includes(q) ||
        a.no_cia.toLowerCase().includes(q)
      )
    })
  }, [alerts, search, sev])

  const counts = useMemo(() => {
    let critical = 0
    let warning = 0
    for (const a of alerts) {
      if (a.severity === 'critical') critical++
      else if (a.severity === 'warning') warning++
    }
    return { critical, warning, total: alerts.length }
  }, [alerts])

  return (
    <>
      <Header>
        <h2 className='text-lg font-semibold me-auto flex items-center gap-2'>
          <AlertTriangle className='h-5 w-5' /> Alertas NCF
        </h2>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main fluid>
        <p className='mb-4 max-w-2xl text-sm text-muted-foreground'>
          Alertas reales de comprobantes fiscales (NCF): rangos de numeración
          por agotarse o ya en nivel crítico, en todas las compañías. La
          numeración disponible se compara contra la cantidad mínima
          configurada en cada rango.
        </p>

        {/* Resumen */}
        <div className='mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3'>
          <Card>
            <CardContent className='flex items-center gap-3 py-4'>
              <span className='rounded-full bg-destructive/10 p-2 text-destructive'>
                <AlertTriangle className='h-5 w-5' />
              </span>
              <div>
                <div className='text-2xl font-bold'>{counts.critical}</div>
                <div className='text-xs text-muted-foreground'>Críticos</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className='flex items-center gap-3 py-4'>
              <span className='rounded-full bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400'>
                <AlertTriangle className='h-5 w-5' />
              </span>
              <div>
                <div className='text-2xl font-bold'>{counts.warning}</div>
                <div className='text-xs text-muted-foreground'>
                  Por agotarse
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className='flex items-center gap-3 py-4'>
              <span className='rounded-full bg-muted p-2 text-muted-foreground'>
                <ShieldCheck className='h-5 w-5' />
              </span>
              <div>
                <div className='text-2xl font-bold'>{counts.total}</div>
                <div className='text-xs text-muted-foreground'>
                  Rangos monitoreados
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className='mb-4 flex flex-wrap items-center gap-2'>
          <Input
            placeholder='Buscar por empresa, código o descripción...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='max-w-sm'
          />
          <div className='flex gap-1'>
            {(
              [
                ['all', 'Todos'],
                ['critical', 'Críticos'],
                ['warning', 'Por agotarse'],
              ] as [SeverityFilter, string][]
            ).map(([key, label]) => (
              <Button
                key={key}
                size='sm'
                variant={sev === key ? 'default' : 'outline'}
                onClick={() => setSev(key)}
              >
                {label}
              </Button>
            ))}
          </div>
          <Button
            variant='outline'
            size='sm'
            className='ms-auto gap-2'
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`}
            />
            Actualizar
          </Button>
        </div>

        <Card>
          <CardContent className='p-0'>
            <div className='overflow-x-auto rounded-md'>
              <Table>
                <TableHeader className='bg-muted/50'>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Código NCF</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className='text-right'>Próximo</TableHead>
                    <TableHead className='text-right'>Disponibles</TableHead>
                    <TableHead className='text-right'>Mínimo</TableHead>
                    <TableHead>Severidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.isLoading && (
                    <TableRow>
                      <TableCell colSpan={7} className='py-6 text-center'>
                        <Loader2 className='inline h-4 w-4 animate-spin' />
                      </TableCell>
                    </TableRow>
                  )}
                  {query.isError && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className='py-6 text-center text-destructive'
                      >
                        No se pudieron cargar las alertas. Verifica tu sesión e
                        intenta actualizar.
                      </TableCell>
                    </TableRow>
                  )}
                  {!query.isLoading &&
                    !query.isError &&
                    filtered.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className='py-6 text-center text-muted-foreground'
                        >
                          No hay alertas para este filtro. Todos los rangos de
                          NCF tienen numeración suficiente.
                        </TableCell>
                      </TableRow>
                    )}
                  {filtered.map((a) => {
                    const meta = SEV_META[a.severity]
                    return (
                      <TableRow
                        key={`${a.no_cia}-${a.codigo_ncf}`}
                        className='hover:bg-muted/50'
                      >
                        <TableCell>
                          <div className='font-medium'>
                            {a.empresa ?? `Compañía ${a.no_cia}`}
                          </div>
                          {a.rnc && (
                            <div className='text-xs text-muted-foreground'>
                              RNC {a.rnc}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className='font-mono font-semibold'>
                          {a.codigo_ncf}
                        </TableCell>
                        <TableCell className='text-sm'>
                          {a.descripcion ?? '—'}
                        </TableCell>
                        <TableCell className='text-right font-mono'>
                          {a.prox_ncf}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono font-semibold ${
                            a.severity === 'critical'
                              ? 'text-destructive'
                              : a.severity === 'warning'
                                ? 'text-amber-600 dark:text-amber-400'
                                : ''
                          }`}
                        >
                          {a.disponibles}
                        </TableCell>
                        <TableCell className='text-right font-mono text-muted-foreground'>
                          {a.cant_min_ncf}
                        </TableCell>
                        <TableCell>
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
