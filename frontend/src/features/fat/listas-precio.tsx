import { useEffect, useState } from 'react'
import { FileSpreadsheet, FileText, List, Pencil, Plus, Printer, Save, Trash2, X } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props { noCia: string; punto: string }

type TipoLista = { no_cia?: string; no_lista: string; descripcion: string; activa: boolean; tipo_moneda: string }
type DetalleLista = { no_produ: string; descripcion: string; precio: number; activo: boolean; nota?: string }

const emptyTipo = { no_lista: '', descripcion: '', activa: true, tipo_moneda: 'RD' }
const emptyDetalle = { no_produ: '', precio: '0', activo: true, nota: '' }

export function ListasPrecioFat({ noCia, punto }: Props) {
  const [tipos, setTipos] = useState<TipoLista[]>([])
  const [detalle, setDetalle] = useState<DetalleLista[]>([])
  const [selectedLista, setSelectedLista] = useState('')
  const [loadingTipos, setLoadingTipos] = useState(false)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [tipoOpen, setTipoOpen] = useState(false)
  const [tipoEdit, setTipoEdit] = useState(false)
  const [tipoForm, setTipoForm] = useState(emptyTipo)
  const [detalleOpen, setDetalleOpen] = useState(false)
  const [detalleEdit, setDetalleEdit] = useState(false)
  const [detalleForm, setDetalleForm] = useState(emptyDetalle)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshTipos = () => {
    if (!noCia) return
    setLoadingTipos(true)
    regalGeneralApi.fatListasPrecio(noCia, punto)
      .then((d) => {
        const nextTipos = (d.tipos ?? []) as TipoLista[]
        setTipos(nextTipos)
        if (!selectedLista && nextTipos.length) setSelectedLista(nextTipos[0].no_lista)
        if (selectedLista && !nextTipos.some(t => t.no_lista === selectedLista)) {
          setSelectedLista(nextTipos[0]?.no_lista ?? '')
        }
      })
      .catch((e) => setError(e?.message || 'Error cargando listas'))
      .finally(() => setLoadingTipos(false))
  }

  const refreshDetalle = () => {
    if (!selectedLista || !noCia) { setDetalle([]); return }
    setLoadingDetalle(true)
    regalGeneralApi.fatListasPrecio(noCia, punto, selectedLista)
      .then((d) => setDetalle((d.detalle as DetalleLista[]) || []))
      .catch((e) => setError(e?.message || 'Error cargando detalle'))
      .finally(() => setLoadingDetalle(false))
  }

  useEffect(() => { refreshTipos() }, [noCia, punto])
  useEffect(() => { refreshDetalle() }, [selectedLista, noCia, punto])

  const openNewTipo = () => {
    setTipoEdit(false)
    setTipoForm(emptyTipo)
    setError(null)
    setTipoOpen(true)
  }

  const openEditTipo = (row: TipoLista) => {
    setTipoEdit(true)
    setTipoForm({
      no_lista: row.no_lista,
      descripcion: row.descripcion,
      activa: !!row.activa,
      tipo_moneda: row.tipo_moneda || 'RD',
    })
    setError(null)
    setTipoOpen(true)
  }

  const saveTipo = async () => {
    if (!tipoForm.no_lista.trim() || !tipoForm.descripcion.trim()) {
      setError('No. lista y descripcion son requeridos')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await regalGeneralApi.fatUpsertListaPrecio({
        kind: 'tipo',
        no_cia: noCia,
        punto,
        no_lista: tipoForm.no_lista.trim().toUpperCase(),
        descripcion: tipoForm.descripcion.trim(),
        activa: tipoForm.activa,
        tipo_moneda: tipoForm.tipo_moneda,
      })
      setTipoOpen(false)
      setSelectedLista(tipoForm.no_lista.trim().toUpperCase())
      refreshTipos()
    } catch (e: any) {
      setError(e?.detail?.detail || e?.detail || e?.message || 'Error guardando lista')
    } finally {
      setSaving(false)
    }
  }

  const deleteTipo = async (row: TipoLista) => {
    if (!window.confirm(`Eliminar lista ${row.no_lista}? Solo se permite si no tiene productos.`)) return
    setSaving(true)
    setError(null)
    try {
      await regalGeneralApi.fatDeleteListaPrecio({ no_cia: noCia, punto, no_lista: row.no_lista })
      if (selectedLista === row.no_lista) setSelectedLista('')
      refreshTipos()
    } catch (e: any) {
      setError(e?.detail?.detail || e?.detail || e?.message || 'Error eliminando lista')
    } finally {
      setSaving(false)
    }
  }

  const openNewDetalle = () => {
    setDetalleEdit(false)
    setDetalleForm(emptyDetalle)
    setError(null)
    setDetalleOpen(true)
  }

  const openEditDetalle = (row: DetalleLista) => {
    setDetalleEdit(true)
    setDetalleForm({
      no_produ: row.no_produ,
      precio: String(row.precio ?? 0),
      activo: !!row.activo,
      nota: row.nota || '',
    })
    setError(null)
    setDetalleOpen(true)
  }

  const saveDetalle = async () => {
    if (!selectedLista) return
    if (!detalleForm.no_produ.trim()) {
      setError('Producto requerido')
      return
    }
    const precio = Number(detalleForm.precio)
    if (Number.isNaN(precio) || precio < 0) {
      setError('Precio invalido')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await regalGeneralApi.fatUpsertListaPrecio({
        kind: 'detalle',
        no_cia: noCia,
        punto,
        no_lista: selectedLista,
        no_produ: detalleForm.no_produ.trim(),
        precio,
        activo: detalleForm.activo,
        nota: detalleForm.nota,
      })
      setDetalleOpen(false)
      refreshDetalle()
    } catch (e: any) {
      setError(e?.detail?.detail || e?.detail || e?.message || 'Error guardando producto')
    } finally {
      setSaving(false)
    }
  }

  const deleteDetalle = async (row: DetalleLista) => {
    if (!window.confirm(`Eliminar producto ${row.no_produ} de la lista ${selectedLista}?`)) return
    setSaving(true)
    setError(null)
    try {
      await regalGeneralApi.fatDeleteListaPrecio({
        no_cia: noCia,
        punto,
        no_lista: selectedLista,
        no_produ: row.no_produ,
      })
      refreshDetalle()
    } catch (e: any) {
      setError(e?.detail?.detail || e?.detail || e?.message || 'Error eliminando producto')
    } finally {
      setSaving(false)
    }
  }

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, '')
    const lista = tipos.find((t) => t.no_lista === selectedLista)
    downloadCsv(
      `fat-lista-precio-${selectedLista}.csv`,
      ['No. Producto', 'Descripcion', 'Precio', 'Activo', 'Nota'],
      detalle.map((r) => [r.no_produ, r.descripcion, Number(r.precio ?? 0).toFixed(4), r.activo ? 'S' : 'N', r.nota || '']),
      { ...meta, mesAno: `Lista: ${selectedLista} ${lista?.descripcion || ''}` },
    )
  }

  const openListadoPdf = () => {
    if (!selectedLista) return
    const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'
    const qs = new URLSearchParams({ no_cia: noCia, punto, no_lista: selectedLista }).toString()
    window.open(`${API_BASE}/fat/reportes/lista-precio/pdf/?${qs}`, '_blank')
  }

  const exportPdf = async () => {
    const lista = tipos.find((t) => t.no_lista === selectedLista)
    const meta = await buildReportMeta(noCia, punto, '')
    const win = window.open('', '_blank')!
    win.document.write(`<html><head><title>RFAT106 - Lista de Precio ${selectedLista}</title>
    <style>body{font-family:Arial,sans-serif;font-size:10px;padding:20px}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:3px 6px}
    th{background:#ddd;font-weight:bold;text-align:left}.hdr{margin-bottom:10px}
    h3{margin:0;font-size:13px}.sub{color:#666}</style></head><body>
    <div class="hdr"><h3>${meta.company}</h3>
    <div class="sub">Lista de Precio: ${selectedLista} - ${lista?.descripcion || ''} (${lista?.tipo_moneda || 'RD'})</div></div>
    <table><thead><tr><th>No. Producto</th><th>Descripcion</th><th style="text-align:right">Precio</th><th>Activo</th></tr></thead>
    <tbody>${detalle.map((r) => `<tr><td>${r.no_produ}</td><td>${r.descripcion}</td>
    <td style="text-align:right">${Number(r.precio ?? 0).toFixed(4)}</td><td>${r.activo ? 'S' : 'N'}</td></tr>`).join('')}
    </tbody></table></body></html>`)
    win.document.close(); win.print()
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='flex items-center gap-2 text-lg font-semibold'>
            <List className='h-5 w-5' /> Mantenimiento Tipo de Lista de Precio
          </h2>
          <p className='text-sm text-muted-foreground'>FFAT106 - Empresa {noCia} - Punto {punto}</p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button size='sm' onClick={openNewTipo}><Plus className='mr-1 h-4 w-4' /> Nueva lista</Button>
          <Button variant='outline' size='sm' onClick={exportPdf} disabled={!selectedLista}><Printer className='mr-1 h-4 w-4' /> PDF</Button>
          <Button variant='outline' size='sm' onClick={openListadoPdf} disabled={!selectedLista}><FileText className='mr-1 h-4 w-4' /> Imprimir PDF</Button>
          <Button variant='outline' size='sm' onClick={exportCsv} disabled={!selectedLista}><FileSpreadsheet className='mr-1 h-4 w-4' /> Excel</Button>
        </div>
      </div>

      {error && <div className='rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'>{String(error)}</div>}

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-20'>No. Lista</TableHead>
              <TableHead>Descripcion</TableHead>
              <TableHead className='w-24 text-center'>Moneda</TableHead>
              <TableHead className='w-20 text-center'>Activa</TableHead>
              <TableHead className='w-32 text-right'>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingTipos && <TableRow><TableCell colSpan={5} className='py-6 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
            {tipos.map((t) => (
              <TableRow key={t.no_lista}
                className={`cursor-pointer ${selectedLista === t.no_lista ? 'bg-muted' : ''}`}
                onClick={() => setSelectedLista(t.no_lista)}>
                <TableCell className='font-mono font-semibold'>{t.no_lista}</TableCell>
                <TableCell className='font-medium'>{t.descripcion}</TableCell>
                <TableCell className='text-center'><Badge variant='outline'>{t.tipo_moneda}</Badge></TableCell>
                <TableCell className='text-center'>
                  <Badge variant={t.activa ? 'default' : 'secondary'}>{t.activa ? 'Activa' : 'Inactiva'}</Badge>
                </TableCell>
                <TableCell className='text-right' onClick={(e) => e.stopPropagation()}>
                  <Button variant='ghost' size='icon' onClick={() => openEditTipo(t)}><Pencil className='h-4 w-4' /></Button>
                  <Button variant='ghost' size='icon' onClick={() => deleteTipo(t)} disabled={saving}><Trash2 className='h-4 w-4' /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedLista && (
        <div className='space-y-2'>
          <div className='flex items-center justify-between gap-2'>
            <h3 className='text-sm font-semibold'>Productos - Lista {selectedLista}</h3>
            <Button size='sm' variant='outline' onClick={openNewDetalle}><Plus className='mr-1 h-4 w-4' /> Agregar producto</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-28'>No. Producto</TableHead>
                <TableHead>Descripcion</TableHead>
                <TableHead className='w-28 text-right'>Precio</TableHead>
                <TableHead className='w-16 text-center'>Activo</TableHead>
                <TableHead className='w-24 text-right'>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingDetalle && <TableRow><TableCell colSpan={5} className='py-6 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
              {!loadingDetalle && detalle.length === 0 && <TableRow><TableCell colSpan={5} className='py-6 text-center text-muted-foreground'>Sin productos en esta lista.</TableCell></TableRow>}
              {detalle.map((r) => (
                <TableRow key={r.no_produ}>
                  <TableCell className='font-mono'>{r.no_produ}</TableCell>
                  <TableCell>{r.descripcion}</TableCell>
                  <TableCell className='text-right font-mono'>{Number(r.precio ?? 0).toFixed(4)}</TableCell>
                  <TableCell className='text-center'>
                    <Badge variant={r.activo ? 'default' : 'secondary'} className='text-xs'>{r.activo ? 'S' : 'N'}</Badge>
                  </TableCell>
                  <TableCell className='text-right'>
                    <Button variant='ghost' size='icon' onClick={() => openEditDetalle(r)}><Pencil className='h-4 w-4' /></Button>
                    <Button variant='ghost' size='icon' onClick={() => deleteDetalle(r)} disabled={saving}><Trash2 className='h-4 w-4' /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={tipoOpen} onOpenChange={setTipoOpen}>
        <DialogContent className='max-w-md'>
          <DialogHeader><DialogTitle>{tipoEdit ? 'Editar lista' : 'Nueva lista'}</DialogTitle></DialogHeader>
          <div className='grid gap-3 py-2'>
            <div className='grid gap-1.5'>
              <Label>No. lista</Label>
              <Input value={tipoForm.no_lista} disabled={tipoEdit} maxLength={2}
                onChange={(e) => setTipoForm({ ...tipoForm, no_lista: e.target.value.toUpperCase() })} />
            </div>
            <div className='grid gap-1.5'>
              <Label>Descripcion</Label>
              <Input value={tipoForm.descripcion}
                onChange={(e) => setTipoForm({ ...tipoForm, descripcion: e.target.value })} />
            </div>
            <div className='grid grid-cols-2 gap-3'>
              <div className='grid gap-1.5'>
                <Label>Moneda</Label>
                <Select value={tipoForm.tipo_moneda} onValueChange={(v) => setTipoForm({ ...tipoForm, tipo_moneda: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='RD'>RD</SelectItem>
                    <SelectItem value='US'>US</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='flex items-end gap-2 pb-2'>
                <Switch checked={tipoForm.activa} onCheckedChange={(v) => setTipoForm({ ...tipoForm, activa: v })} />
                <Label>{tipoForm.activa ? 'Activa' : 'Inactiva'}</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setTipoOpen(false)}><X className='mr-1 h-4 w-4' /> Cancelar</Button>
            <Button onClick={saveTipo} disabled={saving}><Save className='mr-1 h-4 w-4' /> Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className='max-w-md'>
          <DialogHeader><DialogTitle>{detalleEdit ? 'Editar producto' : 'Agregar producto'}</DialogTitle></DialogHeader>
          <div className='grid gap-3 py-2'>
            <div className='grid gap-1.5'>
              <Label>Producto</Label>
              <Input value={detalleForm.no_produ} disabled={detalleEdit}
                onChange={(e) => setDetalleForm({ ...detalleForm, no_produ: e.target.value.toUpperCase() })} />
            </div>
            <div className='grid gap-1.5'>
              <Label>Precio</Label>
              <Input type='number' min={0} step='0.0001' value={detalleForm.precio}
                onChange={(e) => setDetalleForm({ ...detalleForm, precio: e.target.value })} />
            </div>
            <div className='grid gap-1.5'>
              <Label>Nota</Label>
              <Input value={detalleForm.nota}
                onChange={(e) => setDetalleForm({ ...detalleForm, nota: e.target.value })} />
            </div>
            <div className='flex items-center gap-2'>
              <Switch checked={detalleForm.activo} onCheckedChange={(v) => setDetalleForm({ ...detalleForm, activo: v })} />
              <Label>{detalleForm.activo ? 'Activo' : 'Inactivo'}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDetalleOpen(false)}><X className='mr-1 h-4 w-4' /> Cancelar</Button>
            <Button onClick={saveDetalle} disabled={saving}><Save className='mr-1 h-4 w-4' /> Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
