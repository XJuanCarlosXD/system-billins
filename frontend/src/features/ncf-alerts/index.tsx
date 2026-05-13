import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { AlertTriangle, Loader2, Filter } from 'lucide-react'
import { useCompany } from '@/context/company-context'

export function NcfAlertsPage() {
  const { selectedCompany } = useCompany()
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function loadAlerts() {
      setLoading(true)
      try {
        // TODO: Implementar endpoint GET /api/ncf-alerts/?company={selectedCompany}
        // Por ahora, simulamos datos
        setAlerts([
          {
            id: 1,
            codigo: 'NCF-001',
            descripcion: 'Factura duplicada detectada',
            empresa: selectedCompany,
            severidad: 'high',
            fecha: '2026-05-07',
          },
          {
            id: 2,
            codigo: 'NCF-002',
            descripcion: 'Rango NCF agotado',
            empresa: selectedCompany,
            severidad: 'critical',
            fecha: '2026-05-07',
          },
        ])
      } catch (e) {
        console.error('Error loading alerts', e)
      } finally {
        setLoading(false)
      }
    }
    loadAlerts()
  }, [selectedCompany])

  const filtered = alerts.filter((a) =>
    a.codigo.toLowerCase().includes(search.toLowerCase()) ||
    a.descripcion.toLowerCase().includes(search.toLowerCase())
  )

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
        <div className='mb-4 flex items-center gap-2'>
          <Input
            placeholder='Buscar por código o descripción...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='max-w-sm'
          />
          <Button variant='outline' size='sm' className='gap-2'>
            <Filter className='h-4 w-4' />
            Filtros
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center justify-between'>
              <span>Alertas — Empresa {selectedCompany}</span>
              <Badge variant='outline'>{filtered.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='rounded border overflow-hidden'>
              <Table>
                <TableHeader className='bg-muted/50'>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Severidad</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className='text-right'>Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={5} className='text-center py-4'>
                        <Loader2 className='inline h-4 w-4 animate-spin' />
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className='text-center py-4 text-muted-foreground'>
                        Sin alertas en esta empresa
                      </TableCell>
                    </TableRow>
                  )}
                  {filtered.map((a) => (
                    <TableRow key={a.id} className='hover:bg-muted/50'>
                      <TableCell className='font-mono font-semibold'>{a.codigo}</TableCell>
                      <TableCell>{a.descripcion}</TableCell>
                      <TableCell>
                        <Badge variant={a.severidad === 'critical' ? 'destructive' : a.severidad === 'high' ? 'default' : 'secondary'}>
                          {a.severidad}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>{a.fecha}</TableCell>
                      <TableCell className='text-right'>
                        <Button size='sm' variant='outline'>Ver detalles</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
