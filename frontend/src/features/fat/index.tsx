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
import { Receipt, Loader2, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useCompany } from '@/context/company-context'
import { regalGeneralApi } from '@/lib/regal-general-api'

export function FatPage() {
  const { selectedCompany, selectedPoint } = useCompany()
  const [facturas, setFacturas] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    async function loadFacturas() {
      setLoading(true)
      try {
        const res = await regalGeneralApi.fatSearch(selectedCompany, selectedPoint, search, page, pageSize)
        setTotal(res.total)
        setFacturas(res.items)
      } catch (e) {
        console.error('Error loading facturas', e)
      } finally {
        setLoading(false)
      }
    }
    loadFacturas()
  }, [selectedCompany, selectedPoint, search, page, pageSize])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <>
      <Header>
        <h2 className='text-lg font-semibold me-auto flex items-center gap-2'>
          <Receipt className='h-5 w-5' /> Facturación
        </h2>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main fluid>
        <div className='mb-4 flex items-center gap-2'>
          <div className='relative flex-1 max-w-sm'>
            <Search className='absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='Buscar por NCF o cliente...'
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className='ps-8'
            />
          </div>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
            className='h-10 px-3 border rounded text-sm bg-background'
          >
            <option value={10}>10 por pág.</option>
            <option value={20}>20 por pág.</option>
            <option value={50}>50 por pág.</option>
          </select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center justify-between'>
              <span>Facturas — Empresa {selectedCompany}</span>
              <Badge variant='outline'>{total} registros</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='rounded border overflow-hidden'>
              <Table>
                <TableHeader className='bg-muted/50'>
                  <TableRow>
                    <TableHead>NCF</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className='text-right'>Monto</TableHead>
                    <TableHead>Estado</TableHead>
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
                  {!loading && facturas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className='text-center py-4 text-muted-foreground'>
                        Sin facturas encontradas
                      </TableCell>
                    </TableRow>
                  )}
                  {facturas.map((f) => (
                    <TableRow key={f.id} className='hover:bg-muted/50'>
                      <TableCell className='font-mono font-semibold'>{f.ncf}</TableCell>
                      <TableCell className='text-sm text-muted-foreground'>{f.fecha}</TableCell>
                      <TableCell>{f.cliente}</TableCell>
                      <TableCell className='text-right font-mono'>{f.monto}</TableCell>
                      <TableCell>
                        <Badge variant={f.estado === 'pagada' ? 'default' : f.estado === 'pendiente' ? 'secondary' : 'destructive'}>
                          {f.estado}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className='flex items-center justify-between mt-4'>
                <p className='text-sm text-muted-foreground'>
                  Página {page} de {totalPages}
                </p>
                <div className='flex gap-2'>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                  >
                    <ChevronLeft className='h-4 w-4' />
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                  >
                    <ChevronRight className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
