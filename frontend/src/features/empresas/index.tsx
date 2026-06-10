import { useEffect, useMemo, useRef, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Loader2,
  Building2,
  CheckCircle2,
  Settings,
  Upload,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { sigafApi, type Company, ApiError } from '@/lib/sigaf-api'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { useCompany } from '@/context/company-context'

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function gradientFor(no_cia: string): string {
  // Hash estable por no_cia
  let h = 0
  for (const ch of no_cia) h = (h * 31 + ch.charCodeAt(0)) | 0
  const hue = Math.abs(h) % 360
  return `linear-gradient(135deg, hsl(${hue} 65% 55%) 0%, hsl(${(hue + 40) % 360} 70% 45%) 100%)`
}

export function EmpresasPage() {
  const { selectedCompany, setSelectedCompany } = useCompany()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // bust por empresa para invalidar caché de imagen tras upload/delete
  const [logoBust, setLogoBust] = useState<Record<string, number>>({})

  const [editing, setEditing] = useState<Company | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    async function loadCompanies() {
      setLoading(true)
      setError(null)
      try {
        const res = await sigafApi.adminListCompanies()
        setCompanies(res.companies)
      } catch (e) {
        const msg = e instanceof ApiError ? e.detail?.detail || 'Error' : 'Error de red'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
    loadCompanies()
  }, [])

  function openEdit(c: Company) {
    setEditing(c)
    setPendingFile(null)
    setPreview(null)
  }

  function closeEdit() {
    setEditing(null)
    setPendingFile(null)
    setPreview(null)
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 1024) {
      toast.error('Logo muy grande. Máx 1 MB.')
      return
    }
    setPendingFile(file)
    const reader = new FileReader()
    reader.onload = () => setPreview(typeof reader.result === 'string' ? reader.result : null)
    reader.readAsDataURL(file)
  }

  async function saveEdit() {
    if (!editing || !pendingFile) {
      toast.info('Selecciona una imagen para subir.')
      return
    }
    setSaving(true)
    try {
      await regalGeneralApi.cntUploadCiaLogo(editing.no_cia, pendingFile)
      toast.success(`Logo de ${editing.no_cia} actualizado.`)
      setLogoBust((b) => ({ ...b, [editing.no_cia]: Date.now() }))
      closeEdit()
    } catch (e: any) {
      const msg = e?.detail?.error ?? e?.message ?? 'Error subiendo logo'
      toast.error(typeof msg === 'string' ? msg : 'Error subiendo logo')
    } finally {
      setSaving(false)
    }
  }

  async function removeLogo() {
    if (!editing) return
    if (!confirm(`¿Eliminar el logo de ${editing.descripcion}?`)) return
    setSaving(true)
    try {
      await regalGeneralApi.cntDeleteCiaLogo(editing.no_cia)
      toast.success('Logo eliminado.')
      setLogoBust((b) => ({ ...b, [editing.no_cia]: Date.now() }))
      setPreview(null)
      setPendingFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e: any) {
      const msg = e?.detail?.error ?? e?.message ?? 'Error eliminando logo'
      toast.error(typeof msg === 'string' ? msg : 'Error eliminando logo')
    } finally {
      setSaving(false)
    }
  }

  const cards = useMemo(
    () =>
      companies.map((c) => ({
        ...c,
        _logoUrl: regalGeneralApi.cntCiaLogoUrl(c.no_cia, logoBust[c.no_cia] ?? 'init'),
      })),
    [companies, logoBust],
  )

  return (
    <>
      <Header>
        <h2 className='me-auto flex items-center gap-2 text-lg font-semibold'>
          <Building2 className='h-5 w-5' /> Empresas
        </h2>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main>
        <div className='mb-4 flex items-center justify-between'>
          <p className='text-sm text-muted-foreground'>
            {companies.length} empresa(s) registrada(s) — click para seleccionar, ⚙️ para subir/cambiar logo. Los logos aparecen también en los PDFs (facturas, conduces y reportes).
          </p>
        </div>

        {error && (
          <div className='mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300'>
            {error}
          </div>
        )}

        {loading ? (
          <div className='flex justify-center py-12'>
            <Loader2 className='h-6 w-6 animate-spin' />
          </div>
        ) : (
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {cards.map((c) => {
              const isSelected = selectedCompany === c.no_cia
              return (
                <Card
                  key={c.no_cia}
                  className={`group relative overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:shadow-xl ${
                    isSelected ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  <div
                    role='button'
                    tabIndex={0}
                    onClick={() => setSelectedCompany(c.no_cia)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setSelectedCompany(c.no_cia)
                    }}
                    className='relative flex h-28 cursor-pointer items-end overflow-hidden'
                    style={{ background: gradientFor(c.no_cia) }}
                  >
                    {/* Intento de logo desde backend — onError oculta y deja gradient + iniciales */}
                    <img
                      src={c._logoUrl}
                      alt={c.descripcion}
                      className='absolute inset-0 h-full w-full object-cover'
                      onError={(e) => {
                        ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                      }}
                      onLoad={(e) => {
                        ;(e.currentTarget as HTMLImageElement).style.display = 'block'
                      }}
                    />
                    {/* Iniciales fallback (debajo de la imagen) */}
                    <span className='absolute right-3 top-3 text-3xl font-bold text-white/30 mix-blend-overlay'>
                      {initials(c.descripcion || c.no_cia)}
                    </span>
                    {isSelected && (
                      <Badge className='absolute right-2 top-2 z-10 gap-1 shadow'>
                        <CheckCircle2 className='h-3 w-3' /> Activa
                      </Badge>
                    )}
                    <Button
                      variant='secondary'
                      size='icon'
                      className='absolute left-2 top-2 z-10 h-8 w-8 opacity-0 shadow-md transition-opacity group-hover:opacity-100'
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(c)
                      }}
                      title='Subir / cambiar logo'
                    >
                      <Settings className='h-4 w-4' />
                    </Button>
                  </div>

                  <CardContent className='space-y-2 p-4'>
                    <div className='flex items-start justify-between gap-2'>
                      <div className='min-w-0'>
                        <p className='truncate font-semibold leading-tight'>{c.descripcion}</p>
                        <p className='font-mono text-[11px] text-muted-foreground'>
                          # {c.no_cia}
                        </p>
                      </div>
                      <Badge
                        variant={c.activa ? 'default' : 'secondary'}
                        className='shrink-0 text-[10px]'
                      >
                        {c.activa ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>

                    <div className='border-t pt-2 text-xs text-muted-foreground'>
                      <div className='flex items-center justify-between'>
                        <span>RNC</span>
                        <code className='font-mono text-[11px] text-foreground'>
                          {c.rnc || '—'}
                        </code>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Dialog edit logo */}
        <Dialog open={!!editing} onOpenChange={(o) => !o && closeEdit()}>
          <DialogContent className='sm:max-w-md'>
            <DialogHeader>
              <DialogTitle>Logo de empresa</DialogTitle>
              <DialogDescription>
                El logo se guarda en el servidor y se usa en los PDFs (facturas, conduces y reportes). Para cambiar el nombre o el RNC, edita la empresa en su configuración por módulo.
              </DialogDescription>
            </DialogHeader>
            {editing && (
              <div className='space-y-4'>
                <div>
                  <Label className='text-xs text-muted-foreground'>Empresa</Label>
                  <div className='mt-1 flex items-center gap-2'>
                    <code className='rounded bg-muted px-2 py-0.5 font-mono text-xs'>
                      {editing.no_cia}
                    </code>
                    <span className='text-sm text-muted-foreground'>
                      {editing.descripcion}
                    </span>
                  </div>
                </div>

                <div>
                  <Label>Imagen</Label>
                  <div className='mt-1 flex items-center gap-3'>
                    <div className='flex h-20 w-20 items-center justify-center overflow-hidden rounded border bg-muted'>
                      {preview ? (
                        <img src={preview} alt='preview' className='h-full w-full object-cover' />
                      ) : (
                        <img
                          src={regalGeneralApi.cntCiaLogoUrl(editing.no_cia, logoBust[editing.no_cia] ?? 'init')}
                          alt='actual'
                          className='h-full w-full object-cover'
                          onError={(e) => {
                            const t = e.currentTarget as HTMLImageElement
                            t.replaceWith(
                              Object.assign(document.createElement('div'), {
                                innerHTML: '',
                                className: 'flex h-full w-full items-center justify-center',
                              }),
                            )
                          }}
                        />
                      )}
                    </div>
                    <div className='flex flex-col gap-1'>
                      <input
                        ref={fileInputRef}
                        type='file'
                        accept='image/png,image/jpeg,image/jpg,image/gif,image/webp'
                        onChange={onPickFile}
                        className='hidden'
                      />
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() => fileInputRef.current?.click()}
                        disabled={saving}
                      >
                        <Upload className='me-1 h-3.5 w-3.5' /> Subir imagen
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={removeLogo}
                        disabled={saving}
                        className='text-destructive'
                      >
                        <Trash2 className='me-1 h-3.5 w-3.5' /> Quitar actual
                      </Button>
                    </div>
                  </div>
                  <p className='mt-1 text-[11px] text-muted-foreground'>
                    PNG / JPG / GIF / WEBP. Máximo 1 MB.
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant='outline' onClick={closeEdit} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={saveEdit} disabled={saving || !pendingFile}>
                {saving ? 'Guardando…' : 'Guardar logo'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
