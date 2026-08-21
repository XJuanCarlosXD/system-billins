// ClientePicker — patrón validado en FAT-NuevaFactura:
//   [Código] [🔍 Lupa]  → modal con tabla buscable (Código / Nombre / RNC / Dirección)
//   Doble click o "Seleccionar" carga el cliente
//
// Reusable en CXC/CXP/cualquier vista que pida un cliente.
// Card verde con datos al seleccionar (patrón estándar del sistema).
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Search, X, UserCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { CrearClienteModal } from './crear-cliente-modal'

export type Cliente = {
  no_cliente: string | number
  nombre?: string
  nombre_cliente?: string
  rnc?: string
  cedula?: string
  direccion?: string
  telefono?: string
  email?: string
  tipo_ncf?: string
}

type Props = {
  noCia: string
  cliente: Cliente | null
  onChange: (c: Cliente | null) => void
  /** Solo lectura (preview). */
  disabled?: boolean
  /** Mostrar RNC en card. Default true. */
  showRnc?: boolean
}

export function ClientePicker({ noCia, cliente, onChange, disabled, showRnc = true }: Props) {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [codigoInput, setCodigoInput] = useState('')
  const [cargandoCodigo, setCargandoCodigo] = useState(false)
  const [errorCodigo, setErrorCodigo] = useState('')

  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Cliente[]>([])
  const [buscando, setBuscando] = useState(false)
  const [crearOpen, setCrearOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const codigoInputRef = useRef<HTMLInputElement>(null)

  // Cargar cliente por código (al presionar Enter o blur).
  const cargarPorCodigo = async (codigo: string) => {
    setErrorCodigo('')
    const cod = (codigo || '').trim()
    if (!cod) { onChange(null); return }
    setCargandoCodigo(true)
    try {
      // El backend de CXC no tiene endpoint específico /cxc/clientes/<id>,
      // así que listamos con search exacto.
      const res: any = await qc.fetchQuery({
        queryKey: ['cxc-cliente-por-codigo', noCia, cod],
        queryFn: () => regalGeneralApi.cxcListClientes(noCia, cod, 1),
        staleTime: 30_000,
      })
      const items = (res?.items as Cliente[]) || []
      // Match exacto por código primero, si no fallback al primero.
      const exact = items.find(c => String(c.no_cliente).trim() === cod)
      const sel = exact || items[0]
      if (sel) {
        onChange(sel)
        setCodigoInput('')
      } else {
        setErrorCodigo(`Cliente ${cod} no encontrado`)
      }
    } catch (e: any) {
      setErrorCodigo(e?.message || 'Error al buscar')
    } finally {
      setCargandoCodigo(false)
    }
  }

  // Buscar para el modal (debounce simple).
  useEffect(() => {
    if (!modalOpen) return
    if (!search || search.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const res: any = await regalGeneralApi.cxcListClientes(noCia, search, 1)
        setResults((res?.items as Cliente[]) || [])
      } finally {
        setBuscando(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [search, modalOpen, noCia])

  const aplicarCliente = (c: Cliente) => {
    onChange(c)
    setModalOpen(false)
    setSearch('')
    setResults([])
  }

  const abrirModal = () => {
    setModalOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }

  const limpiar = () => {
    onChange(null)
    setCodigoInput('')
    setErrorCodigo('')
    setTimeout(() => codigoInputRef.current?.focus(), 50)
  }

  // ── Card verde con datos del cliente seleccionado ────────────────────
  if (cliente) {
    const nombre = cliente.nombre || cliente.nombre_cliente || '(sin nombre)'
    const rnc = cliente.rnc || cliente.cedula
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-green-300 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30">
        <UserCircle2 className="h-5 w-5 shrink-0 text-green-700" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-mono text-sm font-semibold text-green-900">
              {cliente.no_cliente}
            </span>
            <span className="text-sm font-medium text-green-900 truncate">{nombre}</span>
            {showRnc && rnc && (
              <span className="text-xs text-green-700">
                RNC/Céd: <span className="font-mono">{rnc}</span>
              </span>
            )}
            {cliente.telefono && (
              <span className="text-xs text-green-700">Tel: {cliente.telefono}</span>
            )}
          </div>
          {cliente.direccion && (
            <div className="text-xs text-green-700 truncate mt-0.5">{cliente.direccion}</div>
          )}
        </div>
        {!disabled && (
          <Button size="sm" variant="ghost" onClick={limpiar} className="text-green-800 hover:bg-green-100">
            <X className="h-4 w-4 mr-1" /> Cambiar
          </Button>
        )}
      </div>
    )
  }

  // ── Input código + lupa ──────────────────────────────────────────────
  return (
    <div className="space-y-1">
      {crearOpen && (
        <CrearClienteModal
          open={crearOpen}
          onClose={() => setCrearOpen(false)}
          noCia={noCia}
          nombreInicial={search}
          onCreated={(c) => {
            setCrearOpen(false)
            aplicarCliente(c)
          }}
        />
      )}
      <div className="flex items-end gap-2">
        <div className="w-40 space-y-1">
          <Label className="text-xs">Código cliente</Label>
          <Input
            ref={codigoInputRef}
            value={codigoInput}
            onChange={e => setCodigoInput(e.target.value)}
            onBlur={e => e.target.value && cargarPorCodigo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), cargarPorCodigo(codigoInput))}
            placeholder="Cod. cliente"
            disabled={disabled || cargandoCodigo}
            className="font-mono h-9"
            inputMode="numeric"
          />
        </div>
        <Button
          variant="outline"
          onClick={abrirModal}
          disabled={disabled}
          className="h-9 gap-1"
          type="button"
          title="Buscar cliente"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Buscar</span>
        </Button>
      </div>
      {errorCodigo && (
        <p className="text-xs text-destructive">
          {errorCodigo}{' '}
          <button
            type="button"
            className="underline hover:no-underline"
            onClick={() => { setSearch(codigoInput); setCrearOpen(true) }}
          >
            Crear cliente →
          </button>
        </p>
      )}

      {/* Modal de búsqueda */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent size="picker">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>Buscar Cliente</DialogTitle>
          </DialogHeader>
          <div className="shrink-0 border-b bg-background px-6 py-3">
            <Input
              ref={searchInputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, código o RNC…"
              className="h-11 text-base"
              autoFocus
            />
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="w-32">Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="w-36">RNC / Cédula</TableHead>
                  <TableHead className="w-64">Dirección</TableHead>
                  <TableHead className="w-28 text-center">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                      <p>
                        {buscando
                          ? 'Buscando…'
                          : search.length >= 2
                            ? `No se encontraron clientes para "${search}"`
                            : 'Escriba al menos 2 caracteres para buscar'}
                      </p>
                      {!buscando && search.length >= 2 && (
                        <Button
                          variant="link"
                          className="mt-2"
                          onClick={() => setCrearOpen(true)}
                        >
                          Crear cliente "{search}" →
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )}
                {results.map((c) => {
                  const nombre = c.nombre || c.nombre_cliente || '(sin nombre)'
                  return (
                    <TableRow
                      key={c.no_cliente}
                      className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30"
                      onDoubleClick={() => aplicarCliente(c)}
                    >
                      <TableCell className="font-mono font-semibold">{c.no_cliente}</TableCell>
                      <TableCell className="font-medium">{nombre}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {c.rnc || c.cedula || '—'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {c.direccion || '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button size="sm" className="h-7 px-3" onClick={() => aplicarCliente(c)}>
                          Seleccionar
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex shrink-0 items-center justify-between border-t bg-background px-6 py-3 text-sm text-muted-foreground">
            <span>
              {results.length > 0
                ? `${results.length} cliente${results.length !== 1 ? 's' : ''} encontrado${results.length !== 1 ? 's' : ''}`
                : ''}
            </span>
            <span className="text-xs">Doble click o "Seleccionar" para cargar</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
