import { useEffect, useState } from 'react'
import { Plus, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { toast } from 'sonner'

interface Props { noCia: string; punto: string }

interface Punto {
  no_cia: string; punto: string; descripcion: string
  ano_proceso: number; mes_proceso: number; mes_cierre: number
  fecha_inicial: string | null; fecha_proceso: string | null
  direccion1: string | null; direccion2: string | null
  telefono: string | null; fax: string | null
  activa: string; encargado_sucursal: string | null
  fecha: string | null; grupo_contable: string | null
  esta_en_cierre_p: string; genero_ed_cierre_p: string
}

const MESES = [
  { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' }, { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' }, { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' },
]

function calcFechaFinal(fechaInicial: string | null): string {
  if (!fechaInicial) return ''
  const d = new Date(fechaInicial)
  d.setFullYear(d.getFullYear() + 1)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function f(val: any): string { return val ?? '' }

export function Sucursales({ noCia, punto: puntoProp }: Props) {
  const [puntos, setPuntos] = useState<Punto[]>([])
  const [selectedPunto, setSelectedPunto] = useState<string>(puntoProp)
  const [form, setForm] = useState<Punto | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dlgOpen, setDlgOpen] = useState(false)
  const [newForm, setNewForm] = useState({
    punto: '', descripcion: '',
    ano_proceso: String(new Date().getFullYear()),
    mes_cierre: '12',
  })
  const [creating, setCreating] = useState(false)

  const loadList = async () => {
    const data = await regalGeneralApi.cntSucursales(noCia)
    setPuntos(data as Punto[])
  }

  useEffect(() => {
    if (!noCia) return
    loadList()
  }, [noCia])

  useEffect(() => {
    if (!noCia || !selectedPunto) return
    setLoading(true)
    regalGeneralApi
      .cntSucursales(noCia, selectedPunto)
      .then((data: any) => setForm(Array.isArray(data) ? data[0] : data))
      .finally(() => setLoading(false))
  }, [noCia, selectedPunto])

  const set = (field: keyof Punto, value: any) =>
    setForm((p) => (p ? { ...p, [field]: value } : p))

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    try {
      await regalGeneralApi.cntUpdateSucursal(form.no_cia, form.punto, {
        descripcion: form.descripcion, direccion1: form.direccion1, direccion2: form.direccion2,
        telefono: form.telefono, fax: form.fax, activa: form.activa,
        encargado_sucursal: form.encargado_sucursal,
        grupo_contable: form.grupo_contable, mes_cierre: form.mes_cierre,
      })
      toast.success('Sucursal actualizada.')
    } catch (e: any) { toast.error(e?.message || 'Error al guardar') }
    finally { setSaving(false) }
  }

  const handleCreate = async () => {
    const { punto, descripcion, ano_proceso } = newForm
    if (!punto.trim() || !descripcion.trim() || !ano_proceso) {
      toast.error('Código, descripción y año son requeridos'); return
    }
    setCreating(true)
    try {
      await regalGeneralApi.cntCreateSucursal({
        no_cia: noCia, punto: punto.trim(), descripcion: descripcion.trim(),
        ano_proceso: Number(ano_proceso), mes_cierre: Number(newForm.mes_cierre),
      })
      toast.success(`Sucursal ${punto.trim()} creada.`)
      setDlgOpen(false)
      setNewForm({ punto: '', descripcion: '', ano_proceso: String(new Date().getFullYear()), mes_cierre: '12' })
      await loadList()
      setSelectedPunto(punto.trim())
    } catch (e: any) { toast.error(e?.message || 'Error al crear') }
    finally { setCreating(false) }
  }

  return (
    <div className='space-y-5 max-w-2xl'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-lg font-semibold'>Mantenimiento de Sucursales</h2>
          <p className='text-sm text-muted-foreground'>FCNT102 — Contabilidad General</p>
        </div>
        <Button size='sm' variant='outline' onClick={() => setDlgOpen(true)}>
          <Plus className='mr-1 h-4 w-4' /> Nueva Sucursal
        </Button>
      </div>

      <div className='flex items-center gap-3'>
        <Label className='w-24 shrink-0'>No Cia</Label>
        <Input className='w-20 font-mono' value={noCia} readOnly />
      </div>

      <div className='flex items-center gap-3'>
        <Label className='w-24 shrink-0'>Sucursal</Label>
        <Select value={selectedPunto} onValueChange={setSelectedPunto}>
          <SelectTrigger className='w-64'><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
          <SelectContent>
            {puntos.map((p) => (
              <SelectItem key={p.punto} value={p.punto}>{p.punto} — {p.descripcion}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && <p className='text-sm text-muted-foreground'>Cargando...</p>}

      {form && !loading && (
        <div className='space-y-4'>
          <div className='flex flex-wrap items-center gap-3'>
            <div className='flex items-center gap-2'>
              <Label className='shrink-0 text-xs text-muted-foreground'>Fecha Inicial Año Fiscal</Label>
              <Input className='w-32' value={f(form.fecha_inicial)?.slice(0, 10)} readOnly />
            </div>
            <div className='flex items-center gap-2'>
              <Label className='shrink-0 text-xs text-muted-foreground'>Fecha En Proceso</Label>
              <Input className='w-32' value={f(form.fecha_proceso)?.slice(0, 10)} readOnly />
            </div>
            <div className='flex items-center gap-2'>
              <Label className='shrink-0 text-xs text-muted-foreground'>Fecha Final Año Fiscal</Label>
              <Input className='w-32' value={calcFechaFinal(form.fecha_inicial)} readOnly />
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-4'>
            <div className='flex items-center gap-2'>
              <Label className='shrink-0'>Año en Proceso</Label>
              <Input className='w-20 font-mono' value={f(form.ano_proceso)} readOnly />
            </div>
            <div className='flex items-center gap-2'>
              <Label className='shrink-0'>Mes en Proceso</Label>
              <Input className='w-36' value={MESES.find((m) => m.value === Number(form.mes_proceso))?.label ?? ''} readOnly />
            </div>
            <div className='flex items-center gap-2'>
              <Label className='shrink-0'>Mes De Cierre</Label>
              <Select value={String(form.mes_cierre)} onValueChange={(v) => set('mes_cierre', Number(v))}>
                <SelectTrigger className='w-36'><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className='flex items-center gap-3'>
            <Label className='w-24 shrink-0'>Dirección</Label>
            <Input className='flex-1' value={f(form.direccion1)} onChange={(e) => set('direccion1', e.target.value)} />
          </div>
          <div className='flex items-center gap-3'>
            <Label className='w-24 shrink-0' />
            <Input className='flex-1' value={f(form.direccion2)} onChange={(e) => set('direccion2', e.target.value)} />
          </div>

          <div className='flex flex-wrap items-center gap-3'>
            <Label className='w-24 shrink-0'>Teléfono</Label>
            <Input className='w-44' value={f(form.telefono)} onChange={(e) => set('telefono', e.target.value)} />
            <Label className='shrink-0'>Fax</Label>
            <Input className='w-36' value={f(form.fax)} onChange={(e) => set('fax', e.target.value)} />
          </div>

          <div className='flex flex-wrap items-center gap-4'>
            <div className='flex items-center gap-2'>
              <Checkbox id='activa-p' checked={form.activa === 'S'} onCheckedChange={(v) => set('activa', v ? 'S' : 'N')} />
              <Label htmlFor='activa-p'>Activa</Label>
            </div>
            <div className='flex flex-1 items-center gap-2'>
              <Label className='shrink-0'>Encargado</Label>
              <Input className='flex-1' value={f(form.encargado_sucursal)} onChange={(e) => set('encargado_sucursal', e.target.value)} />
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-4'>
            <div className='flex items-center gap-2'>
              <Label className='shrink-0'>Fecha Creación</Label>
              <Input className='w-36' value={f(form.fecha)?.slice(0, 10)} readOnly />
            </div>
            <div className='flex items-center gap-2'>
              <Label className='shrink-0'>Grupo Contable</Label>
              <Input className='w-20 font-mono' value={f(form.grupo_contable)} onChange={(e) => set('grupo_contable', e.target.value)} />
            </div>
          </div>

          <Separator />

          <div className='space-y-2'>
            <div className='flex items-center gap-2'>
              <Checkbox id='cierre-p' checked={form.esta_en_cierre_p === 'S'} disabled />
              <Label htmlFor='cierre-p' className='text-muted-foreground'>
                La sucursal está en Proceso de Cierre del Período Fiscal
              </Label>
            </div>
            <div className='flex items-center gap-2'>
              <Checkbox id='genero-cierre' checked={form.genero_ed_cierre_p === 'S'} disabled />
              <Label htmlFor='genero-cierre' className='text-muted-foreground'>
                Se Generó El Reporte de Cierre del Período Fiscal
              </Label>
            </div>
          </div>

          <div className='flex justify-end pt-2'>
            <Button onClick={handleSave} disabled={saving}>
              <Save className='mr-2 h-4 w-4' />{saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent size='lg'>
          <DialogHeader><DialogTitle>Nueva Sucursal</DialogTitle></DialogHeader>
          <div className='space-y-3 py-2'>
            <div className='flex items-center gap-3'>
              <Label className='w-28 shrink-0'>No Cia</Label>
              <Input className='w-20 font-mono' value={noCia} readOnly />
            </div>
            <div className='flex items-center gap-3'>
              <Label className='w-28 shrink-0'>Cód. Sucursal</Label>
              <Input className='w-20 font-mono' value={newForm.punto}
                onChange={(e) => setNewForm((p) => ({ ...p, punto: e.target.value }))} placeholder='02' />
            </div>
            <div className='flex items-center gap-3'>
              <Label className='w-28 shrink-0'>Descripción</Label>
              <Input className='flex-1' value={newForm.descripcion}
                onChange={(e) => setNewForm((p) => ({ ...p, descripcion: e.target.value }))} placeholder='Sucursal Norte' />
            </div>
            <div className='flex items-center gap-3'>
              <Label className='w-28 shrink-0'>Año Proceso</Label>
              <Input className='w-24' type='number' value={newForm.ano_proceso}
                onChange={(e) => setNewForm((p) => ({ ...p, ano_proceso: e.target.value }))} />
            </div>
            <div className='flex items-center gap-3'>
              <Label className='w-28 shrink-0'>Mes de Cierre</Label>
              <Select value={newForm.mes_cierre} onValueChange={(v) => setNewForm((p) => ({ ...p, mes_cierre: v }))}>
                <SelectTrigger className='w-36'><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDlgOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? 'Creando...' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
