import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export type EntityColumn<T> = {
  key: keyof T | string
  label: string
  width?: string
  render?: (row: T) => React.ReactNode
}

interface Props<T> {
  open: boolean
  onClose: () => void
  onSelect: (entity: T) => void
  title: string
  placeholder?: string
  /** Cargador de resultados (recibe el texto buscado, devuelve la lista). */
  fetcher: (search: string) => Promise<T[]>
  columns: EntityColumn<T>[]
  /** Llave para react `key={}` por fila. */
  getKey: (entity: T) => string | number
  minChars?: number
}

/**
 * Modal genérico para buscar y seleccionar una entidad (cliente, proveedor,
 * vendedor, etc.). Reemplaza el patrón "input texto donde el usuario tiene
 * que recordar el código" por una experiencia humana: lupa → modal con tabla
 * filtrable → doble clic o botón Seleccionar.
 */
export function EntityPickerModal<T>({
  open,
  onClose,
  onSelect,
  title,
  placeholder = 'Buscar...',
  fetcher,
  columns,
  getKey,
  minChars = 2,
}: Props<T>) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-focus al abrir
  useEffect(() => {
    if (open) {
      setSearch('')
      setResults([])
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Búsqueda con debounce
  useEffect(() => {
    if (!open) return
    if (timerRef.current) clearTimeout(timerRef.current)
    if (search.trim().length < minChars) {
      setResults([])
      return
    }
    setLoading(true)
    timerRef.current = setTimeout(async () => {
      try {
        const data = await fetcher(search.trim())
        setResults(Array.isArray(data) ? data : [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [search, open, minChars, fetcher])

  const handlePick = (e: T) => {
    onSelect(e)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent size='picker'>
        <DialogHeader className='shrink-0 border-b px-6 py-4'>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className='shrink-0 border-b bg-background px-6 py-3'>
          <div className='relative'>
            <Search className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400' />
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              className='h-11 pl-9 text-base'
              autoFocus
            />
          </div>
        </div>
        <div className='flex-1 overflow-y-auto px-6 py-2'>
          <Table>
            <TableHeader className='sticky top-0 z-10 bg-background'>
              <TableRow>
                {columns.map((c) => (
                  <TableHead
                    key={String(c.key)}
                    style={c.width ? { width: c.width } : undefined}
                  >
                    {c.label}
                  </TableHead>
                ))}
                <TableHead className='w-24 text-center'>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + 1}
                    className='py-12 text-center text-gray-400'
                  >
                    {loading
                      ? 'Buscando...'
                      : search.trim().length >= minChars
                        ? 'No se encontraron resultados'
                        : `Escriba al menos ${minChars} caracteres para buscar`}
                  </TableCell>
                </TableRow>
              )}
              {results.map((row) => (
                <TableRow
                  key={getKey(row)}
                  className='cursor-pointer hover:bg-blue-50'
                  onDoubleClick={() => handlePick(row)}
                >
                  {columns.map((c) => (
                    <TableCell key={String(c.key)} className='align-middle'>
                      {c.render
                        ? c.render(row)
                        : String((row as any)[c.key] ?? '—')}
                    </TableCell>
                  ))}
                  <TableCell className='text-center'>
                    <Button
                      size='sm'
                      className='h-7 px-3'
                      onClick={() => handlePick(row)}
                    >
                      Seleccionar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className='flex shrink-0 items-center justify-between border-t bg-background px-6 py-3 text-sm text-gray-500'>
          <span>
            {results.length > 0
              ? `${results.length} resultado${results.length !== 1 ? 's' : ''}`
              : ''}
          </span>
          <span className='text-xs'>
            Doble clic o "Seleccionar" para cargar
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
