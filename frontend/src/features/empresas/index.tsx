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
import { useCompany } from '@/context/company-context'

type LocalOverrides = Record<
  string,
  { displayName?: string; logoDataUrl?: string | null }
>

const STORAGE_KEY = 'zentory:empresa-overrides'

function loadOverrides(): LocalOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as LocalOverrides) : {}
  } catch {
    return {}
  }
}

function saveOverrides(o: LocalOverrides) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(o))
  } catch {
    /* quota or disabled */
  }
}

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
  const [overrides, setOverrides] = useState<LocalOverrides>(() => loadOverrides())

  const [editing, setEditing] = useState<Company | null>(null)
  const [editName, setEditName] = useState('')
  const [editLogo, setEditLogo] = useState<string | null>(null)
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
    const ov = overrides[c.no_cia] ?? {}
    setEditing(c)
    setEditName(ov.displayName ?? c.descripcion)
    setEditLogo(ov.logoDataUrl ?? null)
  }

  function closeEdit() {
    setEditing(null)
    setEditName('')
    setEditLogo(null)
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 512 * 1024) {
      toast.error('Logo muy grande. Máx 500 KB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setEditLogo(typeof reader.result === 'string' ? reader.result : null)
    reader.readAsDataURL(file)
  }

  function removeLogo() {
    setEditLogo(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function saveEdit() {
    if (!editing) return
    const next: LocalOverrides = {
      ...overrides,
      [editing.no_cia]: {
        displayName: editName !== editing.descripcion ? editName : undefined,
        logoDataUrl: editLogo,
      },
    }
    setOverrides(next)
    saveOverrides(next)
    toast.success('Personalización guardada localmente.')
    closeEdit()
  }

  const cards = useMemo(
    () =>
      companies.map((c) => {
        const ov = overrides[c.no_cia] ?? {}
        return {
          ...c,
          _displayName: ov.displayName ?? c.descripcion,
          _logo: ov.logoDataUrl ?? null,
        }
      }),
    [companies, overrides],
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
            {companies.length} empresa(s) registrada(s) — haz click para seleccionar, o usa el ícono ⚙️ para personalizar logo y nombre visible.
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
                  {/* Banner con gradient o logo */}
                  <div
                    role='button'
                    tabIndex={0}
                    onClick={() => setSelectedCompany(c.no_cia)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setSelectedCompany(c.no_cia)
                    }}
                    className='relative flex h-28 cursor-pointer items-end overflow-hidden'
                    style={!c._logo ? { background: gradientFor(c.no_cia) } : undefined}
                  >
                    {c._logo ? (
                      <img
                        src={c._logo}
                        alt={c._displayName}
                        className='absolute inset-0 h-full w-full object-cover'
                      />
                    ) : (
                      <span className='absolute right-3 top-3 text-3xl font-bold text-white/30 mix-blend-overlay'>
                        {initials(c._displayName || c.no_cia)}
                      </span>
                    )}
                    {/* Overlay para legibilidad si hay logo */}
                    {c._logo && (
                      <div className='absolute inset-0 bg-gradient-to-t from-black/60 via-transparent' />
                    )}
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
                      title='Personalizar nombre y logo'
                    >
                      <Settings className='h-4 w-4' />
                    </Button>
                  </div>

                  <CardContent className='space-y-2 p-4'>
                    <div className='flex items-start justify-between gap-2'>
                      <div className='min-w-0'>
                        <p className='truncate font-semibold leading-tight'>{c._displayName}</p>
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

        {/* Dialog edit */}
        <Dialog open={!!editing} onOpenChange={(o) => !o && closeEdit()}>
          <DialogContent className='sm:max-w-md'>
            <DialogHeader>
              <DialogTitle>Personalizar empresa</DialogTitle>
              <DialogDescription>
                Estos cambios son visuales y se guardan en tu navegador. Para cambiar el nombre oficial o el RNC, contacta al administrador.
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
                  <Label htmlFor='display-name'>Nombre visible</Label>
                  <Input
                    id='display-name'
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder={editing.descripcion}
                  />
                </div>

                <div>
                  <Label>Logo</Label>
                  <div className='mt-1 flex items-center gap-3'>
                    <div className='flex h-16 w-16 items-center justify-center overflow-hidden rounded border bg-muted'>
                      {editLogo ? (
                        <img
                          src={editLogo}
                          alt='Logo preview'
                          className='h-full w-full object-cover'
                        />
                      ) : (
                        <ImageIcon className='h-6 w-6 text-muted-foreground' />
                      )}
                    </div>
                    <div className='flex flex-col gap-1'>
                      <input
                        ref={fileInputRef}
                        type='file'
                        accept='image/*'
                        onChange={onPickFile}
                        className='hidden'
                      />
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className='me-1 h-3.5 w-3.5' /> Subir imagen
                      </Button>
                      {editLogo && (
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          onClick={removeLogo}
                          className='text-destructive'
                        >
                          <Trash2 className='me-1 h-3.5 w-3.5' /> Quitar
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className='mt-1 text-[11px] text-muted-foreground'>
                    PNG/JPG/SVG. Máximo 500 KB.
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant='outline' onClick={closeEdit}>
                Cancelar
              </Button>
              <Button onClick={saveEdit}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
