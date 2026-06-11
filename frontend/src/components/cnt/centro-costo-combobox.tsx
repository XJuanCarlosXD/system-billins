// Combobox autocomplete para centros de costo (TCNT_CENTRO_COSTO por empresa).
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { regalGeneralApi } from '@/lib/regal-general-api'

type Props = {
  noCia: string
  value: string
  onChange: (centro: string, descripcion?: string) => void
  /** Centro "sin centro de costo" por defecto: 0000000000 — legado. */
  permitirVacio?: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function CentroCostoCombobox({
  noCia, value, onChange, permitirVacio = true,
  placeholder = '— Sin centro —', disabled = false, className,
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const centrosQ = useQuery({
    queryKey: ['cnt-centros-costo', noCia],
    queryFn: () => regalGeneralApi.cntCentrosCosto(noCia),
    enabled: !!noCia,
    staleTime: 5 * 60 * 1000,
  })

  const centros = useMemo(() => {
    const all = (centrosQ.data as any[]) ?? []
    // TCNT_CENTRO_COSTO en este backend devuelve {centro_costo, descripcion, activo}.
    // Filtramos sólo por activo != 'N' (acepta_movimiento no se devuelve aquí).
    const filtered = all.filter(c => (c.activo ?? c.activa ?? 'S') !== 'N')
    if (!search.trim()) return filtered.slice(0, 80)
    const s = search.toLowerCase()
    return filtered.filter(c =>
      String(c.centro_costo).toLowerCase().includes(s) ||
      String(c.descripcion || c.nombre || '').toLowerCase().includes(s)
    ).slice(0, 80)
  }, [centrosQ.data, search])

  const selected = useMemo(() => {
    const all = (centrosQ.data as any[]) ?? []
    return all.find(c => String(c.centro_costo) === String(value))
  }, [centrosQ.data, value])

  const label = selected
    ? `${selected.centro_costo} — ${selected.descripcion || selected.nombre}`
    : value && value !== '0000000000' ? value : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-mono text-xs h-9',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar centro de costo…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-72">
            {centrosQ.isLoading && <div className="p-3 text-sm text-muted-foreground">Cargando…</div>}
            {!centrosQ.isLoading && centros.length === 0 && search.trim() !== '' && (
              <CommandEmpty>Sin resultados.</CommandEmpty>
            )}
            <CommandGroup>
              {permitirVacio && (
                <CommandItem
                  value="__none__"
                  onSelect={() => { onChange('', ''); setOpen(false); setSearch('') }}
                  className="text-xs text-muted-foreground italic"
                >
                  <Check className={cn('mr-2 h-3 w-3', !value || value === '0000000000' ? 'opacity-100' : 'opacity-0')} />
                  Sin centro de costo
                </CommandItem>
              )}
              {centros.map((c) => {
                const isSel = String(c.centro_costo) === String(value)
                return (
                  <CommandItem
                    key={c.centro_costo}
                    value={c.centro_costo}
                    onSelect={() => {
                      onChange(String(c.centro_costo), c.descripcion || c.nombre)
                      setOpen(false)
                      setSearch('')
                    }}
                    className="text-xs"
                  >
                    <Check className={cn('mr-2 h-3 w-3', isSel ? 'opacity-100' : 'opacity-0')} />
                    <span className="font-mono mr-2 shrink-0">{c.centro_costo}</span>
                    <span className="truncate">{c.descripcion || c.nombre}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
