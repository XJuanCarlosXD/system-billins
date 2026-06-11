// Combobox autocomplete para cuentas contables (TCNT_CATALOGO).
// Reusable en CXC, CXP, CHC, CNT, INV, etc. Filtra acepta_movi='S' activa='S'.
//
// Patrón:
//   <CuentaCombobox value={cuenta} onChange={setCuenta} />
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { regalGeneralApi } from '@/lib/regal-general-api'

type Props = {
  value: string
  onChange: (cuenta: string, nombre?: string) => void
  /** Si true, sólo permite cuentas que aceptan movimientos. Default true. */
  soloMovi?: boolean
  /** Placeholder cuando no hay selección. */
  placeholder?: string
  /** Mostrar como inválido si no encuentra la cuenta seleccionada. */
  required?: boolean
  disabled?: boolean
  className?: string
}

export function CuentaCombobox({
  value, onChange, soloMovi = true, placeholder = 'Seleccione cuenta…',
  required = false, disabled = false, className,
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const cuentasQ = useQuery({
    queryKey: ['cnt-catalogo', soloMovi],
    queryFn: () => regalGeneralApi.cntCatalogo({ activa: true }),
    staleTime: 5 * 60 * 1000, // 5 min cache — el catálogo cambia poco
  })

  const cuentas = useMemo(() => {
    const all = (cuentasQ.data as any[]) ?? []
    const filtered = soloMovi ? all.filter(c => (c.acepta_movi ?? c.aceptaMovi) === 'S') : all
    if (!search.trim()) return filtered.slice(0, 100)
    const s = search.toLowerCase()
    return filtered.filter(c =>
      String(c.cuenta).toLowerCase().includes(s) ||
      String(c.nombre || c.descripcion || '').toLowerCase().includes(s)
    ).slice(0, 100)
  }, [cuentasQ.data, search, soloMovi])

  const selected = useMemo(() => {
    const all = (cuentasQ.data as any[]) ?? []
    return all.find(c => String(c.cuenta) === String(value))
  }, [cuentasQ.data, value])

  const inválida = required && value && !selected
  const label = selected ? `${selected.cuenta} — ${selected.nombre || selected.descripcion}` : value || placeholder

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
            inválida && 'border-destructive',
            className,
          )}
        >
          <span className="truncate">{label}</span>
          {inválida ? <AlertCircle className="ml-2 h-4 w-4 shrink-0 text-destructive" />
                    : <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar cuenta o nombre…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-72">
            {cuentasQ.isLoading && <div className="p-3 text-sm text-muted-foreground">Cargando catálogo…</div>}
            {!cuentasQ.isLoading && cuentas.length === 0 && (
              <CommandEmpty>Sin resultados.</CommandEmpty>
            )}
            <CommandGroup>
              {cuentas.map((c) => {
                const isSel = String(c.cuenta) === String(value)
                return (
                  <CommandItem
                    key={c.cuenta}
                    value={c.cuenta}
                    onSelect={() => {
                      onChange(String(c.cuenta), c.nombre || c.descripcion)
                      setOpen(false)
                      setSearch('')
                    }}
                    className="text-xs"
                  >
                    <Check className={cn('mr-2 h-3 w-3', isSel ? 'opacity-100' : 'opacity-0')} />
                    <span className="font-mono mr-2 shrink-0">{c.cuenta}</span>
                    <span className="truncate">{c.nombre || c.descripcion}</span>
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
