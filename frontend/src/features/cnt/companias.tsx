import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Plus, Save, Trash2 } from 'lucide-react'
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

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface Props { noCia: string }

interface Cia {
  no_cia: string; descripcion: string; direccion1: string | null; direccion2: string | null
  rnc: string | null; telefono1: string | null; telefono2: string | null; fax: string | null
  email: string | null; website: string | null; activa: string
  tasa_us: number | null; itbis: number | null; fecha: string | null
  utilidad_retenida: string | null; cuenta_isr: string | null; cuenta_itbis_retenido: string | null
}

function f(val: any): string { return val ?? '' }

export function Companias({ noCia }: Props) {
  const [cias, setCias] = useState<Cia[]>([])
  const [selected, setSelected] = useState<string>(noCia)
  const [form, setForm] = useState<Cia | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dlgOpen, setDlgOpen] = useState(false)
  const [newForm, setNewForm] = useState({ no_cia: '', descripcion: '', tasa_us: '58', itbis: '18' })
  const [creating, setCreating] = useState(false)

  // Logo state
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadList = () => regalGeneralApi.cntCias().then((d) => setCias(d as Cia[]))

  useEffect(() => { loadList() }, [])

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    regalGeneralApi.cntGetCia(selected).then((d) => setForm(d as Cia)).finally(() => setLoading(false))
    setLogoUrl(`${API_BASE}/cnt/cia-logo/${selected}/?t=${Date.now()}`)
  }, [selected])

  const set = (field: keyof Cia, value: any) =>
    setForm((p) => (p ? { ...p, [field]: value } : p))

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    try {
      await regalGeneralApi.cntUpdateCia(form.no_cia, {
        descripcion: form.descripcion, direccion1: form.direccion1, direccion2: form.direccion2,
        rnc: form.rnc, telefono1: form.telefono1, telefono2: form.telefono2, fax: form.fax,
        email: form.email, website: form.website, activa: form.activa,
        tasa_us: form.tasa_us, itbis: form.itbis,
        utilidad_retenida: form.utilidad_retenida, cuenta_isr: form.cuenta_isr,
        cuenta_itbis_retenido: form.cuenta_itbis_retenido,
      })
      toast.success('Compañía actualizada.')
    } catch (e: any) { toast.error(e?.message || 'Error al guardar') }
    finally { setSaving(false) }
  }

  const handleCreate = async () => {
    const { no_cia, descripcion, tasa_us, itbis } = newForm
    if (!no_cia.trim() || !descripcion.trim()) {
      toast.error('No Cia y Nombre son requeridos'); return
    }
    setCreating(true)
    try {
      await regalGeneralApi.cntCreateCia({ no_cia: no_cia.trim(), descripcion: descripcion.trim(),
        tasa_us: Number(tasa_us), itbis: Number(itbis) })
      toast.success(`Compañía ${no_cia} creada.`)
      setDlgOpen(false)
      setNewForm({ no_cia: '', descripcion: '', tasa_us: '58', itbis: '18' })
      await loadList()
      setSelected(no_cia.trim())
    } catch (e: any) { toast.error(e?.message || 'Error al crear') }
    finally { setCreating(false) }
  }

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true)
    try {
      const fd = new FormData()
      fd.append('no_cia', selected)
      fd.append('logo', file)
      const res = await fetch(`${API_BASE}/cnt/cia-header/`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success('Logo actualizado.')
      setLogoUrl(`${API_BASE}/cnt/cia-logo/${selected}/?t=${Date.now()}`)
    } catch (e: any) {
      toast.error(e?.message || 'Error al subir logo')
    } finally {
      setLogoUploading(false)
    }
  }

  const handleLogoDelete = async () => {
    try {
      await fetch(`${API_BASE}/cnt/cia-header/`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_cia: selected }),
      })
      setLogoUrl(null)
      toast.success('Logo eliminado.')
    } catch { toast.error('Error al eliminar logo') }
  }

  return (
    <div className='space-y-5 max-w-2xl'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-lg font-semibold'>Mantenimiento de Compañías</h2>
          <p className='text-sm text-muted-foreground'>FCNT101 — Contabilidad General</p>
        </div>
        <Button size='sm' variant='outline' onClick={() => setDlgOpen(true)}>
          <Plus className='mr-1 h-4 w-4' /> Nueva Compañía
        </Button>
      </div>

      <div className='flex items-center gap-3'>
        <Label className='w-24 shrink-0'>No Cia</Label>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className='w-64'><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
          <SelectContent>
            {cias.map((c) => (
              <SelectItem key={c.no_cia} value={c.no_cia}>{c.no_cia} — {c.descripcion}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && <p className='text-sm text-muted-foreground'>Cargando...</p>}

      {form && !loading && (
        <div className='space-y-4'>
          {/* Logo section */}
          <div className='flex items-center gap-4 rounded-lg border bg-muted/30 p-4'>
            <div className='flex h-20 w-32 items-center justify-center overflow-hidden rounded-md border bg-white'>
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt='Logo'
                  className='h-full w-full object-contain'
                  onError={() => setLogoUrl(null)}
                />
              ) : (
                <span className='text-xs text-muted-foreground text-center px-1'>Sin logo</span>
              )}
            </div>
            <div className='space-y-2'>
              <p className='text-sm font-medium'>Logo de la compañía</p>
              <p className='text-xs text-muted-foreground'>Aparece en todos los reportes PDF y Excel.<br />PNG, JPG o SVG. Máx 2 MB.</p>
              <div className='flex gap-2'>
                <input
                  ref={fileRef}
                  type='file'
                  accept='image/*'
                  className='hidden'
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleLogoUpload(file)
                    e.target.value = ''
                  }}
                />
                <Button size='sm' variant='outline' disabled={logoUploading} onClick={() => fileRef.current?.click()}>
                  <ImagePlus className='mr-1 h-4 w-4' />
                  {logoUploading ? 'Subiendo...' : 'Subir logo'}
                </Button>
                {logoUrl && (
                  <Button size='sm' variant='ghost' className='text-destructive hover:text-destructive' onClick={handleLogoDelete}>
                    <Trash2 className='mr-1 h-4 w-4' /> Eliminar
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className='flex items-center gap-3'>
            <Label className='w-24 shrink-0'>Nombre</Label>
            <Input className='flex-1' value={f(form.descripcion)} onChange={(e) => set('descripcion', e.target.value)} />
          </div>
          <div className='flex items-center gap-3'>
            <Label className='w-24 shrink-0'>Dirección</Label>
            <Input className='flex-1' value={f(form.direccion1)} onChange={(e) => set('direccion1', e.target.value)} />
          </div>
          <div className='flex items-center gap-3'>
            <Label className='w-24 shrink-0' />
            <Input className='flex-1' value={f(form.direccion2)} onChange={(e) => set('direccion2', e.target.value)} />
          </div>
          <div className='flex items-center gap-3'>
            <Label className='w-24 shrink-0'>RNC</Label>
            <Input className='w-48' value={f(form.rnc)} onChange={(e) => set('rnc', e.target.value)} />
          </div>
          <div className='flex flex-wrap items-center gap-3'>
            <Label className='w-24 shrink-0'>Teléfonos</Label>
            <Input className='w-36' placeholder='Tel 1' value={f(form.telefono1)} onChange={(e) => set('telefono1', e.target.value)} />
            <Input className='w-36' placeholder='Tel 2' value={f(form.telefono2)} onChange={(e) => set('telefono2', e.target.value)} />
            <Label className='shrink-0'>Fax</Label>
            <Input className='w-32' value={f(form.fax)} onChange={(e) => set('fax', e.target.value)} />
          </div>
          <div className='flex items-center gap-3'>
            <Label className='w-24 shrink-0'>Email</Label>
            <Input className='flex-1' type='email' value={f(form.email)} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div className='flex items-center gap-3'>
            <Label className='w-24 shrink-0'>Website</Label>
            <Input className='flex-1' value={f(form.website)} onChange={(e) => set('website', e.target.value)} />
          </div>
          <div className='flex flex-wrap items-center gap-4'>
            <div className='flex items-center gap-2'>
              <Checkbox id='activa' checked={form.activa === 'S'} onCheckedChange={(v) => set('activa', v ? 'S' : 'N')} />
              <Label htmlFor='activa'>Activa</Label>
            </div>
            <div className='flex items-center gap-2'>
              <Label className='shrink-0'>Tasa US</Label>
              <Input className='w-24' type='number' step='0.01' value={form.tasa_us ?? ''} onChange={(e) => set('tasa_us', e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div className='flex items-center gap-2'>
              <Label className='shrink-0'>ITBIS %</Label>
              <Input className='w-20' type='number' step='0.01' value={form.itbis ?? ''} onChange={(e) => set('itbis', e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div className='flex items-center gap-2'>
              <Label className='shrink-0'>Fecha</Label>
              <Input className='w-32' type='date' value={f(form.fecha)?.slice(0, 10)} readOnly />
            </div>
          </div>
          <Separator />
          <p className='text-xs font-semibold uppercase tracking-wide text-center text-muted-foreground'>Cuenta Contable</p>
          <div className='flex items-center gap-3'>
            <Label className='w-36 shrink-0'>Utilidad Retenida</Label>
            <Input className='w-48 font-mono' value={f(form.utilidad_retenida)} onChange={(e) => set('utilidad_retenida', e.target.value)} />
          </div>
          <div className='flex items-center gap-3'>
            <Label className='w-36 shrink-0'>ISR Retenido</Label>
            <Input className='w-48 font-mono' value={f(form.cuenta_isr)} onChange={(e) => set('cuenta_isr', e.target.value)} />
          </div>
          <div className='flex items-center gap-3'>
            <Label className='w-36 shrink-0'>ITBIS Retenido</Label>
            <Input className='w-48 font-mono' value={f(form.cuenta_itbis_retenido)} onChange={(e) => set('cuenta_itbis_retenido', e.target.value)} />
          </div>
          <div className='flex justify-end pt-2'>
            <Button onClick={handleSave} disabled={saving}>
              <Save className='mr-2 h-4 w-4' />{saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      )}

      {/* Dialog nueva compañía */}
      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader><DialogTitle>Nueva Compañía</DialogTitle></DialogHeader>
          <div className='space-y-3 py-2'>
            <div className='flex items-center gap-3'>
              <Label className='w-24 shrink-0'>No Cia</Label>
              <Input className='w-20 font-mono' value={newForm.no_cia}
                onChange={(e) => setNewForm((p) => ({ ...p, no_cia: e.target.value }))} placeholder='01' />
            </div>
            <div className='flex items-center gap-3'>
              <Label className='w-24 shrink-0'>Nombre</Label>
              <Input className='flex-1' value={newForm.descripcion}
                onChange={(e) => setNewForm((p) => ({ ...p, descripcion: e.target.value }))} placeholder='Empresa SRL' />
            </div>
            <div className='flex items-center gap-3'>
              <Label className='w-24 shrink-0'>Tasa US</Label>
              <Input className='w-24' type='number' value={newForm.tasa_us}
                onChange={(e) => setNewForm((p) => ({ ...p, tasa_us: e.target.value }))} />
            </div>
            <div className='flex items-center gap-3'>
              <Label className='w-24 shrink-0'>ITBIS %</Label>
              <Input className='w-20' type='number' value={newForm.itbis}
                onChange={(e) => setNewForm((p) => ({ ...p, itbis: e.target.value }))} />
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
