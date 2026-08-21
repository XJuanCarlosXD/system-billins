// FCXC115 — Mantenimiento de Clientes
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Pencil, Plus, Trash2, Search } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { CrearClienteModal } from '@/components/cxc/crear-cliente-modal'

interface P { noCia: string; punto?: string }

export function CxcClientes({ noCia, punto = '01' }: P) {
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [editingNoCliente, setEditingNoCliente] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (pg = page, search = q) => {
    setLoading(true)
    try {
      const res = await regalGeneralApi.cxcListClientes(noCia, search, pg)
      setRows(res.items || [])
      setTotal(res.count || 0)
    } finally { setLoading(false) }
  }, [noCia, page, q])

  useEffect(() => { load(page, q) }, [page])

  const search = () => { setPage(1); load(1, q) }

  const openNew = () => { setEditingNoCliente(null); setOpen(true) }
  const openEdit = (row: any) => { setEditingNoCliente(row.no_cliente); setOpen(true) }

  const del = async (row: any) => {
    if (!confirm(`¿Inactivar cliente ${row.no_cliente} — ${row.nombre_cliente}?`)) return
    await regalGeneralApi.cxcDeleteCliente(noCia, row.no_cliente)
    load(page, q)
  }

  const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })
  const pageSize = 50

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Mantenimiento de Clientes</h1>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />Nuevo Cliente</Button>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Buscar por nombre o código..." value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()} className="max-w-sm" />
        <Button onClick={search} variant="secondary"><Search className="h-4 w-4 mr-1" />Buscar</Button>
      </div>

      <div className="text-sm text-muted-foreground">{total} cliente{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">No Cliente</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-28">RNC</TableHead>
              <TableHead className="w-24">NCF</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead className="w-28">Límite Crd.</TableHead>
              <TableHead className="w-20">Días</TableHead>
              <TableHead className="w-20">Estado</TableHead>
              <TableHead className="w-20">Acc.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={9} className="text-center py-8">Cargando...</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sin resultados</TableCell></TableRow>}
            {rows.map(r => (
              <TableRow key={r.no_cliente}>
                <TableCell className="font-mono">{r.no_cliente}</TableCell>
                <TableCell className="font-medium">{r.nombre_cliente}</TableCell>
                <TableCell>{r.rnc}</TableCell>
                <TableCell className="font-mono text-xs">{r.codigo_ncf || ''}</TableCell>
                <TableCell>{r.nombre_vendedor || r.vendedor}</TableCell>
                <TableCell className="text-right">{fmt(r.limite_credito)}</TableCell>
                <TableCell className="text-center">{r.dias_credito}</TableCell>
                <TableCell>
                  <Badge variant={r.activo === 'S' ? 'default' : 'secondary'}>{r.activo === 'S' ? 'Activo' : 'Inactivo'}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => del(r)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Anterior</Button>
        <span className="text-sm">Pág. {page} / {Math.max(1, Math.ceil(total / pageSize))}</span>
        <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= total}>Siguiente</Button>
      </div>

      <CrearClienteModal
        open={open}
        onClose={() => { setOpen(false); setEditingNoCliente(null) }}
        noCia={noCia}
        punto={punto}
        editingNoCliente={editingNoCliente}
        onCreated={() => { setOpen(false); setEditingNoCliente(null); load(1, q); setPage(1) }}
        onUpdated={() => { setOpen(false); setEditingNoCliente(null); load(page, q) }}
      />
    </div>
  )
}
