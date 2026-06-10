import { useState } from 'react'
import { Check, ChevronLeft, ChevronsUpDown, Plus, Save, Trash2 } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select as UiSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

type Linea = {
  cuenta: string
  cuenta_desc?: string
  tipo_movi: 'D' | 'C'
  monto: string
}

type CuentaOption = {
  value: string
  label: string
  descripcion: string
}

type Props = {
  noCia: string
  punto: string
  ano: number
  mes: number
  onClose: () => void
  onSaved: () => void
}

export function AsientoForm({ noCia, punto, ano, mes, onClose, onSaved }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [fecha, setFecha] = useState(today)
  const [detalle, setDetalle] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([
    { cuenta: '', tipo_movi: 'D', monto: '' },
    { cuenta: '', tipo_movi: 'C', monto: '' },
  ])
  const [cuentaOptions, setCuentaOptions] = useState<Record<number, CuentaOption[]>>({})
  const [cuentaOpen, setCuentaOpen] = useState<Record<number, boolean>>({})
  const [cuentaQuery, setCuentaQuery] = useState<Record<number, string>>({})
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const searchCuenta = async (idx: number, query: string) => {
    if (!query.trim()) {
      setCuentaOptions((current) => ({ ...current, [idx]: [] }))
      return
    }
    const rows = await regalGeneralApi.cntCatalogo({ search: query, activa: true })
    const options = (rows || [])
      .filter((row: any) => row.acepta_movimiento === 'S')
      .slice(0, 30)
      .map((row: any) => ({
        value: row.cuenta,
        label: `${row.cuenta} - ${row.descripcion}`,
        descripcion: row.descripcion,
      }))
    setCuentaOptions((current) => ({ ...current, [idx]: options }))
  }

  const selectCuenta = (idx: number, option: CuentaOption | null) => {
    setLineas((current) =>
      current.map((linea, lineIndex) =>
        lineIndex === idx
          ? {
              ...linea,
              cuenta: option?.value || '',
              cuenta_desc: option?.descripcion || '',
            }
          : linea,
      ),
    )
    setCuentaOpen((current) => ({ ...current, [idx]: false }))
    setCuentaQuery((current) => ({ ...current, [idx]: option?.label || '' }))
  }

  const updateLinea = (idx: number, field: keyof Linea, value: string) => {
    setLineas((current) =>
      current.map((linea, lineIndex) =>
        lineIndex === idx ? { ...linea, [field]: value } : linea,
      ),
    )
  }

  const totalD = lineas
    .filter((linea) => linea.tipo_movi === 'D')
    .reduce((sum, linea) => sum + (parseFloat(linea.monto) || 0), 0)
  const totalC = lineas
    .filter((linea) => linea.tipo_movi === 'C')
    .reduce((sum, linea) => sum + (parseFloat(linea.monto) || 0), 0)
  const cuadra = Math.abs(totalD - totalC) < 0.001

  const save = async () => {
    if (!detalle.trim()) {
      setErr('Detalle requerido')
      return
    }
    if (!cuadra) {
      setErr('El asiento no cuadra')
      return
    }
    const data = lineas
      .filter((linea) => linea.cuenta && linea.monto)
      .map((linea) => ({
        cuenta: linea.cuenta,
        tipo_movi: linea.tipo_movi,
        monto: parseFloat(linea.monto),
      }))

    if (data.length < 2) {
      setErr('Se requieren al menos dos lineas')
      return
    }

    setSaving(true)
    setErr('')
    try {
      await regalGeneralApi.cntCreateAsiento({
        no_cia: noCia,
        punto,
        ano,
        mes,
        fecha,
        detalle,
        lineas: data,
      })
      onSaved()
    } catch (error: any) {
      setErr(error.message ?? 'Error guardando el asiento')
    } finally {
      setSaving(false)
    }
  }

  const fmt = (value: number) => value.toLocaleString('es-DO', { minimumFractionDigits: 2 })

  return (
    <div className='space-y-5'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h3 className='text-lg font-semibold'>Nuevo asiento</h3>
          <p className='text-sm text-muted-foreground'>Vista de captura en linea, sin modal, usando el mismo periodo activo.</p>
        </div>
        <Button variant='outline' size='sm' onClick={onClose}>
          <ChevronLeft className='mr-2 h-4 w-4' /> Volver al listado
        </Button>
      </div>

      <div className='grid gap-4 rounded-xl border p-4 md:grid-cols-2'>
        <div>
          <label className='mb-1 block text-xs font-medium'>Fecha</label>
          <Input type='date' value={fecha} onChange={(event) => setFecha(event.target.value)} className='h-9' />
        </div>
        <div>
          <label className='mb-1 block text-xs font-medium'>Detalle</label>
          <Input value={detalle} onChange={(event) => setDetalle(event.target.value)} className='h-9' placeholder='Descripcion del asiento' />
        </div>
      </div>

      <div className='space-y-3 rounded-xl border p-4'>
        <div className='flex items-center justify-between'>
          <span className='text-sm font-medium'>Lineas del asiento</span>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setLineas((current) => [...current, { cuenta: '', tipo_movi: 'D', monto: '' }])}
          >
            <Plus className='mr-2 h-4 w-4' /> Agregar linea
          </Button>
        </div>

        <div className='space-y-3'>
          {lineas.map((linea, idx) => (
            <div key={idx} className='grid gap-3 lg:grid-cols-[minmax(0,2fr)_160px_160px_48px]'>
              <div>
                <label className='mb-1 block text-xs font-medium'>Cuenta</label>
                <Popover
                  open={Boolean(cuentaOpen[idx])}
                  onOpenChange={(open) => {
                    setCuentaOpen((current) => ({ ...current, [idx]: open }))
                    if (open) {
                      const baseQuery = linea.cuenta ? `${linea.cuenta} ${linea.cuenta_desc || ''}` : ''
                      setCuentaQuery((current) => ({ ...current, [idx]: baseQuery }))
                      void searchCuenta(idx, baseQuery)
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant='outline'
                      role='combobox'
                      aria-expanded={Boolean(cuentaOpen[idx])}
                      className='h-9 w-full justify-between overflow-hidden px-3 font-normal'
                    >
                      <span className='truncate text-left'>
                        {linea.cuenta ? `${linea.cuenta} - ${linea.cuenta_desc || ''}` : 'Buscar cuenta...'}
                      </span>
                      <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className='w-[420px] p-0' align='start'>
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder='Buscar cuenta...'
                        value={cuentaQuery[idx] || ''}
                        onValueChange={(value) => {
                          setCuentaQuery((current) => ({ ...current, [idx]: value }))
                          void searchCuenta(idx, value)
                        }}
                      />
                      <CommandList>
                        <CommandEmpty>Sin coincidencias.</CommandEmpty>
                        <CommandGroup>
                          {(cuentaOptions[idx] || []).map((option) => (
                            <CommandItem
                              key={option.value}
                              value={option.label}
                              onSelect={() => selectCuenta(idx, option)}
                              className='flex items-start gap-2'
                            >
                              <Check
                                className={cn(
                                  'mt-0.5 h-4 w-4',
                                  linea.cuenta === option.value ? 'opacity-100' : 'opacity-0',
                                )}
                              />
                              <div className='min-w-0'>
                                <div className='truncate font-mono text-xs'>{option.value}</div>
                                <div className='truncate text-xs text-muted-foreground'>{option.descripcion}</div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className='mb-1 block text-xs font-medium'>Tipo</label>
                <UiSelect value={linea.tipo_movi} onValueChange={(value) => updateLinea(idx, 'tipo_movi', value)}>
                  <SelectTrigger className='h-9'><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='D'>Debito</SelectItem>
                    <SelectItem value='C'>Credito</SelectItem>
                  </SelectContent>
                </UiSelect>
              </div>
              <div>
                <label className='mb-1 block text-xs font-medium'>Monto</label>
                <Input
                  value={linea.monto}
                  onChange={(event) => updateLinea(idx, 'monto', event.target.value)}
                  placeholder='0.00'
                  className='h-9 text-right'
                />
              </div>
              <div className='flex items-end'>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-9 w-9'
                  onClick={() => setLineas((current) => current.filter((_, lineIndex) => lineIndex !== idx))}
                  disabled={lineas.length <= 2}
                >
                  <Trash2 className='h-4 w-4 text-red-500' />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className='flex flex-wrap items-center justify-end gap-4 rounded-xl border bg-muted/30 px-4 py-3 text-sm font-medium'>
        <span>Debitos: {fmt(totalD)}</span>
        <span>Creditos: {fmt(totalC)}</span>
        {!cuadra && <span className='text-destructive'>No cuadra</span>}
      </div>

      {err && <p className='text-sm text-destructive'>{err}</p>}

      <div className='flex justify-end gap-2'>
        <Button variant='outline' onClick={onClose}>Cancelar</Button>
        <Button onClick={save} disabled={saving || !cuadra}>
          <Save className='mr-2 h-4 w-4' />
          {saving ? 'Guardando...' : 'Guardar asiento'}
        </Button>
      </div>
    </div>
  )
}
