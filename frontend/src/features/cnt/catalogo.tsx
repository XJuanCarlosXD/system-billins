import { useEffect, useState } from 'react'
import { Check, Pencil, Plus, Search, X } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Props { noCia: string; punto: string; ano: number; mes: number }

export function CatalogoCuentas({ noCia, punto }: Props) {
  const [rows, setRows] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editRow, setEditRow] = useState<any | null>(null)
  const [tcuenta, setTcuenta] = useState<any[]>([])

  const load = () => {
    setLoading(true)
    regalGeneralApi.cntCatalogo({ search: search || undefined }).then(setRows).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [search])

  useEffect(() => {
    regalGeneralApi.cntTcuenta().then(setTcuenta)
  }, [])

  const pagedRows = rows.slice((page - 1) * 25, page * 25)
  const totalPages = Math.max(1, Math.ceil(rows.length / 25))

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>Catalogo de cuentas</h2>
          <p className='text-sm text-muted-foreground'>Busqueda, paginacion y mantenimiento del catalogo corporativo.</p>
        </div>
        <Button size='sm' onClick={() => { setEditRow(null); setShowForm(true) }}>
          <Plus className='mr-2 h-4 w-4' /> Nueva cuenta
        </Button>
      </div>

      <div className='relative rounded-xl border p-4'>
        <Search className='absolute left-6 top-6 h-4 w-4 text-muted-foreground' />
        <Input
          placeholder='Buscar cuenta o descripcion...'
          className='h-9 pl-8'
          value={search}
          onChange={(event) => {
            setPage(1)
            setSearch(event.target.value)
          }}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cuenta</TableHead>
            <TableHead>Descripcion</TableHead>
            <TableHead className='text-center'>Clase</TableHead>
            <TableHead className='text-center'>Tipo</TableHead>
            <TableHead className='text-center'>Mov.</TableHead>
            <TableHead className='text-center'>Activa</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={7} className='py-8 text-center text-muted-foreground'>Cargando...</TableCell>
            </TableRow>
          )}
          {!loading && pagedRows.map((row) => (
            <TableRow key={row.cuenta}>
              <TableCell className='font-mono font-medium'>{row.cuenta}</TableCell>
              <TableCell>{row.descripcion}</TableCell>
              <TableCell className='text-center'>
                <Badge variant='outline' className='font-mono'>{row.clase}</Badge>
              </TableCell>
              <TableCell className='text-center text-muted-foreground'>{row.tipo}</TableCell>
              <TableCell className='text-center'>
                {row.acepta_movimiento === 'S'
                  ? <Check className='mx-auto h-3 w-3 text-green-600' />
                  : <X className='mx-auto h-3 w-3 text-muted-foreground' />}
              </TableCell>
              <TableCell className='text-center'>
                {row.activa === 'S'
                  ? <Check className='mx-auto h-3 w-3 text-green-600' />
                  : <X className='mx-auto h-3 w-3 text-red-500' />}
              </TableCell>
              <TableCell>
                <Button variant='ghost' size='icon' className='h-6 w-6' onClick={() => { setEditRow(row); setShowForm(true) }}>
                  <Pencil className='h-3 w-3' />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className='py-8 text-center text-muted-foreground'>Sin resultados</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className='flex items-center justify-between text-sm'>
        <span className='text-muted-foreground'>Pagina {page} de {totalPages}</span>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Anterior</Button>
          <Button variant='outline' size='sm' disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente</Button>
        </div>
      </div>

      {showForm && (
        <CuentaForm
          initial={editRow}
          tcuenta={tcuenta}
          noCia={noCia}
          punto={punto}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}
    </div>
  )
}

function CuentaForm({ initial, tcuenta, noCia, punto, onClose, onSaved }: any) {
  const [form, setForm] = useState({
    cuenta: initial?.cuenta ?? '',
    descripcion: initial?.descripcion ?? '',
    tipo: String(initial?.tipo ?? ''),
    clase: initial?.clase ?? 'A',
    acepta_movimiento: initial?.acepta_movimiento ?? 'S',
    activa: initial?.activa ?? 'S',
  })
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    setErr('')
    try {
      if (initial) {
        await regalGeneralApi.cntUpdateCuenta(initial.cuenta, { ...form, no_cia: noCia, punto })
      } else {
        await regalGeneralApi.cntCreateCuenta({ ...form, no_cia: noCia, punto })
      }
      onSaved()
    } catch (error: any) {
      setErr(error.message ?? 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar cuenta' : 'Nueva cuenta'}</DialogTitle>
        </DialogHeader>
        <div className='space-y-3 text-sm'>
          <div className='space-y-1'>
            <label className='text-xs font-medium'>Cuenta *</label>
            <Input value={form.cuenta} disabled={!!initial} onChange={(event) => setForm((current) => ({ ...current, cuenta: event.target.value }))} placeholder='ej: 1101-01' />
          </div>
          <div className='space-y-1'>
            <label className='text-xs font-medium'>Descripcion *</label>
            <Input value={form.descripcion} onChange={(event) => setForm((current) => ({ ...current, descripcion: event.target.value }))} />
          </div>
          <div className='grid grid-cols-2 gap-2'>
            <div className='space-y-1'>
              <label className='text-xs font-medium'>Tipo</label>
              <Select value={form.tipo} onValueChange={(value) => setForm((current) => ({ ...current, tipo: value }))}>
                <SelectTrigger className='h-8 text-xs'><SelectValue placeholder='Tipo' /></SelectTrigger>
                <SelectContent>
                  {tcuenta.map((tipo: any) => (
                    <SelectItem key={tipo.tipo} value={String(tipo.tipo)}>{tipo.tipo} - {tipo.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1'>
              <label className='text-xs font-medium'>Clase</label>
              <Select value={form.clase} onValueChange={(value) => setForm((current) => ({ ...current, clase: value }))}>
                <SelectTrigger className='h-8 text-xs'><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['A', 'P', 'C', 'I', 'E'].map((clase) => <SelectItem key={clase} value={clase}>{clase}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className='flex gap-4'>
            <label className='flex items-center gap-2 text-xs'>
              <Checkbox checked={form.acepta_movimiento === 'S'} onCheckedChange={(value) => setForm((current) => ({ ...current, acepta_movimiento: value ? 'S' : 'N' }))} />
              Acepta movimiento
            </label>
            <label className='flex items-center gap-2 text-xs'>
              <Checkbox checked={form.activa === 'S'} onCheckedChange={(value) => setForm((current) => ({ ...current, activa: value ? 'S' : 'N' }))} />
              Activa
            </label>
          </div>
          {err && <p className='text-xs text-red-500'>{err}</p>}
          <div className='flex justify-end gap-2 pt-2'>
            <Button variant='outline' size='sm' onClick={onClose}>Cancelar</Button>
            <Button size='sm' onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
