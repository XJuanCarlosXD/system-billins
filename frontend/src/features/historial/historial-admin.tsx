import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { historialAdmin } from '@/lib/api-client-historial'
import { HistorialTimeline } from './historial-timeline'

const MODULOS = ['FAT', 'CXC', 'CXP', 'INV', 'ACC', 'CHC', 'SDN', 'ODC', 'ACF', 'CNT', 'MAN']
const ACCIONES = ['CREAR', 'EDITAR', 'ANULAR', 'REVERSAR']
const PAGE_SIZE = 25

export function HistorialAdmin() {
  const [usuario, setUsuario] = useState('')
  const [modulo, setModulo] = useState('')
  const [accion, setAccion] = useState('')
  const [noDocumento, setNoDocumento] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['historial-admin', usuario, modulo, accion, noDocumento, page],
    queryFn: () =>
      historialAdmin({
        usuario: usuario || undefined,
        modulo: modulo || undefined,
        accion: accion || undefined,
        no_documento: noDocumento || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <Header>
        <h2 className='text-lg font-semibold me-auto'>Historial / Auditoría</h2>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main>
        <div className='space-y-4'>
          <div>
            <h3 className='text-base font-semibold'>Historial / Auditoría</h3>
            <p className='text-sm text-muted-foreground'>
              Todo lo que los usuarios crearon, editaron o anularon en el sistema.
            </p>
          </div>

          <Card>
            <CardContent className='pt-4'>
              <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
                <div>
                  <Label className='text-xs'>Usuario</Label>
                  <Input value={usuario} onChange={(e) => { setUsuario(e.target.value); setPage(1) }} placeholder='JCABREU' />
                </div>
                <div>
                  <Label className='text-xs'>Módulo</Label>
                  <Select value={modulo || 'ALL'} onValueChange={(v) => { setModulo(v === 'ALL' ? '' : v); setPage(1) }}>
                    <SelectTrigger><SelectValue placeholder='Todos' /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='ALL'>Todos</SelectItem>
                      {MODULOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className='text-xs'>Acción</Label>
                  <Select value={accion || 'ALL'} onValueChange={(v) => { setAccion(v === 'ALL' ? '' : v); setPage(1) }}>
                    <SelectTrigger><SelectValue placeholder='Todas' /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='ALL'>Todas</SelectItem>
                      {ACCIONES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className='text-xs'>No. Documento</Label>
                  <Input value={noDocumento} onChange={(e) => { setNoDocumento(e.target.value); setPage(1) }} placeholder='0001234' />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Search className='h-5 w-5' />
                Eventos {isFetching && <span className='text-xs text-muted-foreground'>actualizando…</span>}
              </CardTitle>
              <CardDescription>{total} evento(s) encontrados.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className='text-sm text-muted-foreground py-4'>Cargando…</div>
              ) : (
                <HistorialTimeline eventos={data?.items ?? []} modo='completo' />
              )}
              <div className='flex items-center justify-between mt-4'>
                <Button variant='outline' size='sm' disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className='h-4 w-4' /> Anterior
                </Button>
                <span className='text-xs text-muted-foreground'>Página {page} de {totalPages}</span>
                <Button variant='outline' size='sm' disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Siguiente <ChevronRight className='h-4 w-4' />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}
