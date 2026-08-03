import { useEffect, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { GuardedButton } from '@/components/access'
import { AsientoForm } from './asiento-form'

interface Props {
  noCia: string
  punto: string
  ano: number
  mes: number
  mode?: 'process' | 'query'
}

type StatusFilter = 'all' | 'borrador' | 'autorizado' | 'actualizado' | 'anulado'

export function AsientosList({ noCia, punto, ano, mes, mode = 'process' }: Props) {
  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [detail, setDetail] = useState<any | null>(null)

  const load = () => {
    if (!noCia || !punto) return
    setLoading(true)
    regalGeneralApi
      .cntAsientos(noCia, punto, ano, mes, {
        page,
        search: search || undefined,
        autorizado: statusFilter === 'autorizado' ? true : undefined,
        actualizado: statusFilter === 'actualizado' ? true : undefined,
        anulado: statusFilter === 'anulado' ? true : undefined,
      })
      .then((data) => {
        const rows = (data.items || []).filter((item: any) => {
          if (statusFilter === 'borrador') {
            return item.st_anulado !== 'S' && item.autorizado !== 'S'
          }
          return true
        })
        setItems(rows)
        setTotal(data.total || 0)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [noCia, punto, ano, mes, page, search, statusFilter])

  const openDetail = async (item: any) => {
    const data = await regalGeneralApi.cntGetAsiento(noCia, punto, ano, mes, item.no_asiento)
    setDetail(data)
  }

  const aprobar = async (noAsiento: number) => {
    await regalGeneralApi.cntAprobar(noAsiento, { no_cia: noCia, punto, ano, mes })
    load()
  }

  const actualizar = async (noAsiento: number) => {
    await regalGeneralApi.cntActualizar(noAsiento, { no_cia: noCia, punto, ano, mes })
    load()
  }

  const anular = async (noAsiento: number) => {
    if (!confirm('Anular asiento?')) return
    await regalGeneralApi.cntAnular(noAsiento, { no_cia: noCia, punto, ano, mes })
    load()
  }

  const statusBadge = (item: any) => {
    if (item.st_anulado === 'S') return <Badge variant='destructive' className='text-xs'>Anulado</Badge>
    if (item.actualizado === 'S') return <Badge className='text-xs'>Actualizado</Badge>
    if (item.autorizado === 'S') return <Badge variant='secondary' className='text-xs'>Autorizado</Badge>
    return <Badge variant='outline' className='text-xs'>Borrador</Badge>
  }

  const fmt = (value: any) => Number(value || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })

  if (showForm) {
    return (
      <AsientoForm
        noCia={noCia}
        punto={punto}
        ano={ano}
        mes={mes}
        onClose={() => setShowForm(false)}
        onSaved={() => {
          setShowForm(false)
          load()
        }}
      />
    )
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>
            {mode === 'process' ? 'Asientos contables' : 'Consulta de asientos'} - {ano}/{String(mes).padStart(2, '0')}
          </h2>
          <p className='text-sm text-muted-foreground'>
            {mode === 'process'
              ? 'Captura y control operativo del diario contable.'
              : 'Filtro global por texto, estado y paginacion del periodo seleccionado.'}
          </p>
        </div>
        {mode === 'process' && (
          <Button size='sm' onClick={() => setShowForm(true)}>
            <Plus className='mr-2 h-4 w-4' /> Nuevo asiento
          </Button>
        )}
      </div>

      <div className='grid gap-3 rounded-xl border p-4 md:grid-cols-[minmax(0,1fr)_180px]'>
        <div className='relative'>
          <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder='Buscar por detalle, numero o texto...'
            className='h-9 pl-8'
            value={search}
            onChange={(event) => {
              setPage(1)
              setSearch(event.target.value)
            }}
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => { setPage(1); setStatusFilter(value as StatusFilter) }}>
          <SelectTrigger className='h-9'><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Todos los estados</SelectItem>
            <SelectItem value='borrador'>Borrador</SelectItem>
            <SelectItem value='autorizado'>Autorizado</SelectItem>
            <SelectItem value='actualizado'>Actualizado</SelectItem>
            <SelectItem value='anulado'>Anulado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>No.</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Detalle</TableHead>
            <TableHead className='text-right'>Debitos</TableHead>
            <TableHead className='text-right'>Creditos</TableHead>
            <TableHead className='text-center'>Estado</TableHead>
            <TableHead className='text-right'>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={7} className='py-8 text-center text-muted-foreground'>Cargando...</TableCell>
            </TableRow>
          )}
          {!loading && items.map((item) => (
            <TableRow key={item.no_asiento} className='cursor-pointer' onClick={() => openDetail(item)}>
              <TableCell className='font-mono'>{item.no_asiento}</TableCell>
              <TableCell>{item.fecha ? String(item.fecha).substring(0, 10) : ''}</TableCell>
              <TableCell className='max-w-xs truncate'>{item.detalle}</TableCell>
              <TableCell className='text-right font-mono'>{fmt(item.debitos)}</TableCell>
              <TableCell className='text-right font-mono'>{fmt(item.creditos)}</TableCell>
              <TableCell className='text-center' onClick={(event) => event.stopPropagation()}>{statusBadge(item)}</TableCell>
              <TableCell className='text-right' onClick={(event) => event.stopPropagation()}>
                <div className='flex items-center justify-end gap-1'>
                  {mode === 'process' && item.st_anulado !== 'S' && item.autorizado !== 'S' && (
                    <GuardedButton modulo='cnt' flag='APROBAR_ASIENTO' noCia={noCia} punto={punto} variant='ghost' size='sm' className='h-7 text-xs' onClick={() => aprobar(item.no_asiento)}>Aprobar</GuardedButton>
                  )}
                  {mode === 'process' && item.autorizado === 'S' && item.actualizado !== 'S' && item.st_anulado !== 'S' && (
                    <GuardedButton modulo='cnt' flag='ACTUALIZAR_ASIENTO' noCia={noCia} punto={punto} variant='ghost' size='sm' className='h-7 text-xs text-blue-600' onClick={() => actualizar(item.no_asiento)}>Actualizar</GuardedButton>
                  )}
                  {mode === 'process' && item.actualizado !== 'S' && item.st_anulado !== 'S' && (
                    <GuardedButton modulo='cnt' flag='ACTUALIZAR_ASIENTO' noCia={noCia} punto={punto} variant='ghost' size='sm' className='h-7 text-xs text-red-500' onClick={() => anular(item.no_asiento)}>Anular</GuardedButton>
                  )}
                  <Button variant='ghost' size='sm' className='h-7 text-xs' onClick={() => openDetail(item)}>Ver</Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {!loading && items.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className='py-8 text-center text-muted-foreground'>Sin asientos para ese filtro.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {total > 0 && (
        <div className='flex items-center justify-between text-sm'>
          <span className='text-muted-foreground'>Pagina {page} de {Math.max(1, Math.ceil(total / 50))}</span>
          <div className='flex gap-2'>
            <Button variant='outline' size='sm' disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Anterior</Button>
            <Button variant='outline' size='sm' disabled={page >= Math.ceil(total / 50)} onClick={() => setPage((current) => current + 1)}>Siguiente</Button>
          </div>
        </div>
      )}

      {detail && <AsientoDetalle detail={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function AsientoDetalle({ detail, onClose }: { detail: any; onClose: () => void }) {
  const fmt = (value: any) => Number(value || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4' onClick={onClose}>
      <div className='max-h-[80vh] w-full max-w-2xl overflow-auto rounded-lg bg-background p-4 shadow-xl' onClick={(event) => event.stopPropagation()}>
        <div className='mb-3 flex items-start justify-between'>
          <div>
            <h3 className='font-semibold'>Asiento #{detail.no_asiento}</h3>
            <p className='text-xs text-muted-foreground'>{detail.detalle}</p>
          </div>
          <Button variant='ghost' size='icon' onClick={onClose}><X className='h-4 w-4' /></Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuenta</TableHead>
              <TableHead>Descripcion</TableHead>
              <TableHead className='text-right'>Debito</TableHead>
              <TableHead className='text-right'>Credito</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(detail.lineas || []).map((linea: any) => (
              <TableRow key={linea.no_linea}>
                <TableCell className='font-mono'>{linea.cuenta}</TableCell>
                <TableCell>{linea.cuenta_desc}</TableCell>
                <TableCell className='text-right font-mono'>{linea.tipo_movi === 'D' ? fmt(linea.monto) : ''}</TableCell>
                <TableCell className='text-right font-mono'>{linea.tipo_movi === 'C' ? fmt(linea.monto) : ''}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
