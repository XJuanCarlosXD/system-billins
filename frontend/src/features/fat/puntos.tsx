import { useEffect, useState } from 'react'
import { MapPin, Plus, Pencil } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Props { noCia: string }

type Punto = {
  no_cia: string; punto: string; descripcion: string
  max_descuento: number; activo: boolean; ano_proceso: number; mes_proceso: number
  mes_cierre?: number
}

type FormState = {
  punto: string; descripcion: string; max_descuento: string
  activo: boolean; ano_proceso: string; mes_proceso: string; mes_cierre: string
}

const emptyForm = (): FormState => {
  const now = new Date()
  return {
    punto: '', descripcion: '', max_descuento: '0',
    activo: true,
    ano_proceso: String(now.getFullYear()),
    mes_proceso: String(now.getMonth() + 1),
    mes_cierre: '12',
  }
}

export function PuntosTrabajoFat({ noCia }: Props) {
  const [rows, setRows] = useState<Punto[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'create' | 'edit'>('create')
  const [form, setForm] = useState<FormState>(emptyForm())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    if (!noCia) return
    setLoading(true)
    regalGeneralApi.fatListPuntos(noCia)
      .then((d) => setRows(d.items as Punto[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [noCia])

  const openCreate = () => {
    setMode('create')
    setForm(emptyForm())
    setError(null)
    setOpen(true)
  }

  const openEdit = (row: Punto) => {
    setMode('edit')
    setForm({
      punto: row.punto,
      descripcion: row.descripcion,
      max_descuento: String(row.max_descuento ?? 0),
      activo: !!row.activo,
      ano_proceso: String(row.ano_proceso ?? 0),
      mes_proceso: String(row.mes_proceso ?? 0),
      mes_cierre: String(row.mes_cierre ?? 0),
    })
    setError(null)
    setOpen(true)
  }

  const validate = (): string | null => {
    const punto = form.punto.trim().toUpperCase()
    if (!punto) return 'El código del punto es requerido'
    if (punto.length > 2) return 'El código del punto no puede exceder 2 caracteres'
    const desc = form.descripcion.trim()
    if (!desc) return 'La descripción es requerida'
    if (desc.length > 40) return 'La descripción no puede exceder 40 caracteres'
    const md = Number(form.max_descuento)
    if (Number.isNaN(md) || md < 0) return 'Máx. descuento debe ser un número >= 0'
    const ano = Number(form.ano_proceso)
    if (!Number.isInteger(ano) || ano < 0) return 'Año proceso inválido'
    const mp = Number(form.mes_proceso)
    if (!Number.isInteger(mp) || mp < 0 || mp > 12) return 'Mes proceso debe estar entre 0 y 12'
    const mc = Number(form.mes_cierre)
    if (!Number.isInteger(mc) || mc < 0 || mc > 12) return 'Mes cierre debe estar entre 0 y 12'
    return null
  }

  const submit = async () => {
    const errMsg = validate()
    if (errMsg) { setError(errMsg); return }
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        no_cia: noCia,
        punto: form.punto.trim().toUpperCase(),
        descripcion: form.descripcion.trim(),
        max_descuento: Number(form.max_descuento),
        activo: form.activo,
        ano_proceso: Number(form.ano_proceso),
        mes_proceso: Number(form.mes_proceso),
        mes_cierre: Number(form.mes_cierre),
      }
      await regalGeneralApi.fatUpsertPunto(payload, mode === 'edit' ? 'PATCH' : 'POST')
      setOpen(false)
      refresh()
    } catch (e: any) {
      let msg = e?.message || 'Error al guardar el punto'
      try {
        const parsed = JSON.parse(msg)
        if (parsed?.detail) msg = parsed.detail
      } catch { /* noop */ }
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className='space-y-4'>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <MapPin className='h-5 w-5' /> Puntos de Trabajo
          </h2>
          <p className='text-sm text-muted-foreground'>FFAT102 — Empresa {noCia} — Configuración de puntos</p>
        </div>
        <Button onClick={openCreate} size='sm' className='gap-2'>
          <Plus className='h-4 w-4' /> Crear nuevo
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-16'>Punto</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className='w-28 text-right'>Máx. Desc. %</TableHead>
            <TableHead className='w-20 text-center'>Año Proceso</TableHead>
            <TableHead className='w-20 text-center'>Mes Proceso</TableHead>
            <TableHead className='w-20 text-center'>Estado</TableHead>
            <TableHead className='w-20 text-right'>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>No hay puntos configurados para esta empresa.</TableCell></TableRow>}
          {rows.map((row) => (
            <TableRow key={`${row.no_cia}-${row.punto}`}>
              <TableCell className='font-mono font-semibold'>{row.punto}</TableCell>
              <TableCell className='font-medium'>{row.descripcion}</TableCell>
              <TableCell className='text-right'>{row.max_descuento}%</TableCell>
              <TableCell className='text-center font-mono'>{row.ano_proceso || '—'}</TableCell>
              <TableCell className='text-center font-mono'>{row.mes_proceso || '—'}</TableCell>
              <TableCell className='text-center'>
                <Badge variant={row.activo ? 'default' : 'secondary'}>{row.activo ? 'Activo' : 'Inactivo'}</Badge>
              </TableCell>
              <TableCell className='text-right'>
                <Button variant='ghost' size='sm' onClick={() => openEdit(row)} className='gap-1'>
                  <Pencil className='h-3.5 w-3.5' /> Editar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>{mode === 'edit' ? 'Editar punto de trabajo' : 'Crear punto de trabajo'}</DialogTitle>
            <DialogDescription>
              Empresa <span className='font-mono'>{noCia}</span> — FFAT102
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-3 py-2'>
            <div className='grid gap-1.5'>
              <Label htmlFor='punto'>Código punto (máx 2)</Label>
              <Input
                id='punto' value={form.punto} maxLength={2}
                disabled={mode === 'edit'}
                onChange={(e) => setForm({ ...form, punto: e.target.value.toUpperCase() })}
                placeholder='01' className='font-mono uppercase' />
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='descripcion'>Descripción (máx 40)</Label>
              <Input
                id='descripcion' value={form.descripcion} maxLength={40}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder='Sucursal principal' />
            </div>
            <div className='grid grid-cols-2 gap-3'>
              <div className='grid gap-1.5'>
                <Label htmlFor='max_descuento'>Máx. descuento %</Label>
                <Input
                  id='max_descuento' type='number' min={0} step='0.01'
                  value={form.max_descuento}
                  onChange={(e) => setForm({ ...form, max_descuento: e.target.value })} />
              </div>
              <div className='flex items-end gap-2 pb-1'>
                <Switch
                  id='activo' checked={form.activo}
                  onCheckedChange={(v) => setForm({ ...form, activo: v })} />
                <Label htmlFor='activo'>{form.activo ? 'Activo' : 'Inactivo'}</Label>
              </div>
            </div>
            <div className='grid grid-cols-3 gap-3'>
              <div className='grid gap-1.5'>
                <Label htmlFor='ano_proceso'>Año proceso</Label>
                <Input
                  id='ano_proceso' type='number' min={0} value={form.ano_proceso}
                  onChange={(e) => setForm({ ...form, ano_proceso: e.target.value })} />
              </div>
              <div className='grid gap-1.5'>
                <Label htmlFor='mes_proceso'>Mes proceso</Label>
                <Input
                  id='mes_proceso' type='number' min={0} max={12} value={form.mes_proceso}
                  onChange={(e) => setForm({ ...form, mes_proceso: e.target.value })} />
              </div>
              <div className='grid gap-1.5'>
                <Label htmlFor='mes_cierre'>Mes cierre</Label>
                <Input
                  id='mes_cierre' type='number' min={0} max={12} value={form.mes_cierre}
                  onChange={(e) => setForm({ ...form, mes_cierre: e.target.value })} />
              </div>
            </div>
            {error && <p className='text-sm text-destructive'>{error}</p>}
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? 'Guardando...' : (mode === 'edit' ? 'Guardar' : 'Crear')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
