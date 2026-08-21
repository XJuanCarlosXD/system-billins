import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv } from '@/lib/csv-utils'
import { CrearProveedorModal } from './components/crear-proveedor-modal'

interface Proveedor {
  no_proveedor: string; nombre: string; rnc: string; cedula: string
  telefono: string; celular: string; e_mail: string; direccion: string
  plazo_pago: number; activo: string; excento_itbis: string
  categoria: string; clasificacion: string
  cuenta_banco: string; codigo_banco: string; tipo_cuenta: string
}

const PAGE = 50

export function CxpProveedores() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [soloActivos, setSoloActivos] = useState(true)
  const [open, setOpen] = useState(false)
  const [editingNoProveedor, setEditingNoProveedor] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const { data = [], isLoading, isError } = useQuery<Proveedor[]>({
    queryKey: ['cxp-proveedores', search, soloActivos],
    queryFn: () => api.cxpListProveedores({ search, activo: soloActivos ? 'S' : '' }),
    staleTime: 60_000,
  })

  const totalPages = Math.max(1, Math.ceil(data.length / PAGE))
  const slice = data.slice((page - 1) * PAGE, page * PAGE)

  function openNew() { setEditingNoProveedor(null); setOpen(true) }
  function openEdit(p: Proveedor) { setEditingNoProveedor(p.no_proveedor); setOpen(true) }

  function refresh() {
    qc.invalidateQueries({ queryKey: ['cxp-proveedores'] })
    setOpen(false)
    setEditingNoProveedor(null)
  }

  function exportExcel() {
    downloadCsv(data.map(r => ({
      No: r.no_proveedor, Nombre: r.nombre, RNC: r.rnc,
      Teléfono: r.telefono, Correo: r.e_mail, Activo: r.activo,
    })), 'cxp-proveedores.csv')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          <Input
            placeholder="Buscar nombre o RNC…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-60"
          />
          <Button variant="outline" size="sm" onClick={() => setSoloActivos(v => !v)}>
            {soloActivos ? 'Solo activos' : 'Todos'}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel}>Excel</Button>
          <Button size="sm" onClick={openNew}>+ Nuevo</Button>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>RNC / Cédula</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead className="text-right">Plazo</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
            ) : isError ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-red-500">Error al cargar proveedores. Intente nuevamente.</TableCell></TableRow>
            ) : slice.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sin resultados</TableCell></TableRow>
            ) : slice.map(p => (
              <TableRow key={p.no_proveedor} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(p)}>
                <TableCell className="font-mono text-xs">{p.no_proveedor}</TableCell>
                <TableCell>{p.nombre}</TableCell>
                <TableCell className="font-mono text-xs">{p.rnc || p.cedula}</TableCell>
                <TableCell>{p.telefono}</TableCell>
                <TableCell className="text-right">{p.plazo_pago}d</TableCell>
                <TableCell>
                  <Badge className={p.activo === 'S' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                    {p.activo === 'S' ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm items-center">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <span>Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
        </div>
      )}

      <CrearProveedorModal
        open={open}
        onClose={() => { setOpen(false); setEditingNoProveedor(null) }}
        editingNoProveedor={editingNoProveedor}
        onCreated={refresh}
        onUpdated={refresh}
      />
    </div>
  )
}
