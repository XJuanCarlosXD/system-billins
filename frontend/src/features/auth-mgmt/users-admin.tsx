import { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Loader2, Plus, Lock, Unlock, KeyRound, RefreshCw, ShieldAlert, ShieldCheck,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUp, ArrowDown, ArrowUpDown,
  Pencil,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { regalGeneralApi, ApiError, type AdminUser, type Me, type Company } from '@/lib/regal-general-api'
import { UserAccessPage } from './user-access-page'

type OrderBy = 'username' | 'created' | 'status'
type Direction = 'asc' | 'desc'

function statusBadge(s: string) {
  if (s === 'OPEN') return <Badge>activo</Badge>
  if (s.startsWith('LOCKED')) return <Badge variant='destructive'>bloqueado</Badge>
  if (s.startsWith('EXPIRED')) return <Badge variant='secondary'>expirado</Badge>
  return <Badge variant='outline'>{s.toLowerCase()}</Badge>
}

function CreateUserDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await regalGeneralApi.adminCreateUser(username.toUpperCase(), password, fullName.trim(), role.trim())
      toast.success(`Usuario ${username.toUpperCase()} creado`)
      setOpen(false)
      setUsername(''); setPassword(''); setFullName(''); setRole('')
      onCreated()
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail?.detail || 'Error al crear' : 'Error de red'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className='me-2 h-4 w-4' /> Nuevo usuario
        </Button>
      </DialogTrigger>
      <DialogContent size='lg'>
        <DialogHeader>
          <DialogTitle>Crear usuario Oracle</DialogTitle>
          <DialogDescription>
            Crea un usuario nativo en Oracle 11g. Recibe los grants CONNECT, RESOURCE y rol Regal General.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className='grid gap-3'>
          <div className='grid gap-1.5'>
            <Label htmlFor='u'>Usuario</Label>
            <Input id='u' value={username} onChange={(e) => setUsername(e.target.value.toUpperCase())} placeholder='NUEVOUSER' autoCapitalize='characters' required />
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='p'>Contraseña inicial</Label>
            <Input id='p' type='text' value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='fn'>Nombre completo</Label>
            <Input id='fn' value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder='Ej. Juan Pérez' required />
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='rl'>Rol / puesto</Label>
            <Input id='rl' value={role} onChange={(e) => setRole(e.target.value)} placeholder='Ej. Encargada de Contabilidad' />
          </div>
          <DialogFooter>
            <Button type='submit' disabled={loading}>
              {loading ? <Loader2 className='animate-spin' /> : <Plus />} Crear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditProfileDialog({ user, onDone }: { user: AdminUser; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState(user.full_name || '')
  const [role, setRole] = useState(user.role || '')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await regalGeneralApi.adminUpdateUser(user.username, { full_name: fullName.trim(), role: role.trim() })
      toast.success(`Datos de ${user.username} actualizados`)
      setOpen(false)
      onDone()
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail?.detail || 'Error' : 'Error de red'
      toast.error(msg)
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size='sm' variant='outline' title='Editar nombre y rol'>
          <Pencil className='h-3.5 w-3.5' />
        </Button>
      </DialogTrigger>
      <DialogContent size='lg'>
        <DialogHeader>
          <DialogTitle>Nombre y rol — {user.username}</DialogTitle>
          <DialogDescription>Se guarda en la ficha de empleado (MAN.TCSC) del sistema.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className='grid gap-3'>
          <div className='grid gap-1.5'>
            <Label htmlFor='efn'>Nombre completo</Label>
            <Input id='efn' value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder='Ej. Juan Pérez' required />
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='erl'>Rol / puesto</Label>
            <Input id='erl' value={role} onChange={(e) => setRole(e.target.value)} placeholder='Ej. Encargada de Contabilidad' />
          </div>
          <DialogFooter>
            <Button type='submit' disabled={loading}>
              {loading ? <Loader2 className='animate-spin' /> : <Pencil />} Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({ user, onDone }: { user: AdminUser; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [pwd, setPwd] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await regalGeneralApi.adminUpdateUser(user.username, { new_password: pwd })
      toast.success(`Contraseña reseteada para ${user.username}`)
      setOpen(false); setPwd(''); onDone()
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail?.detail || 'Error' : 'Error de red'
      toast.error(msg)
    } finally { setLoading(false) }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size='sm' variant='outline' title='Resetear contraseña'>
          <KeyRound className='h-3.5 w-3.5' />
        </Button>
      </DialogTrigger>
      <DialogContent size='xl'>
        <DialogHeader>
          <DialogTitle>Resetear contraseña — {user.username}</DialogTitle>
          <DialogDescription>El usuario tendrá que cambiarla luego desde su perfil.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className='grid gap-3'>
          <Label htmlFor='np'>Nueva contraseña</Label>
          <Input id='np' value={pwd} onChange={(e) => setPwd(e.target.value)} required />
          <DialogFooter>
            <Button type='submit' disabled={loading}>
              {loading ? <Loader2 className='animate-spin' /> : <KeyRound />} Resetear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SortHeader({
  label, field, current, dir, onChange,
}: { label: string; field: OrderBy; current: OrderBy; dir: Direction; onChange: (f: OrderBy, d: Direction) => void }) {
  const isActive = current === field
  const Icon = !isActive ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <button
      type='button'
      className='inline-flex items-center gap-1 hover:underline'
      onClick={() => onChange(field, isActive && dir === 'desc' ? 'asc' : 'desc')}
    >
      {label} <Icon className='h-3 w-3' />
    </button>
  )
}

export function UsersAdminPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState('')
  const [includeLocked, setIncludeLocked] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [orderBy, setOrderBy] = useState<OrderBy>('created')
  const [direction, setDirection] = useState<Direction>('desc')
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)

  async function loadMe() {
    try {
      const m = await regalGeneralApi.me()
      setMe(m)
      setCompanies(m.companies.filter((c) => c.activa))
    } catch {
      // ignored
    }
  }

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await regalGeneralApi.adminListUsers({
        q: search.trim() || undefined,
        includeLocked, page, pageSize, orderBy, direction,
      })
      setUsers(res.items)
      setTotal(res.total)
      setTotalPages(res.total_pages)
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail?.detail || 'Sin acceso' : 'Error de red'
      setError(msg); setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMe() }, [])
  useEffect(() => { load() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, orderBy, direction, includeLocked])

  function applySearch() { setPage(1); load() }

  function changeOrder(field: OrderBy, dir: Direction) {
    setOrderBy(field); setDirection(dir); setPage(1)
  }

  async function toggleLock(u: AdminUser) {
    const locking = u.account_status === 'OPEN'
    try {
      await regalGeneralApi.adminUpdateUser(u.username, { locked: locking })
      toast.success(`${u.username} ${locking ? 'bloqueado' : 'desbloqueado'}`)
      load()
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail?.detail || 'Error' : 'Error de red'
      toast.error(msg)
    }
  }

  const range = useMemo(() => {
    if (total === 0) return '0'
    const from = (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, total)
    return `${from}–${to} de ${total}`
  }, [page, pageSize, total])

  if (me && !me.is_admin) {
    return (
      <>
        <Header>
          <h2 className='text-lg font-semibold me-auto'>Acceso restringido</h2>
          <ThemeSwitch /><ProfileDropdown />
        </Header>
        <Main>
          <Card>
            <CardContent className='py-8 text-center'>
              <ShieldAlert className='mx-auto mb-2 h-10 w-10 text-amber-500' />
              <p className='text-muted-foreground'>
                Solo usuarios con rol DBA / Regal General pueden administrar usuarios.
              </p>
            </CardContent>
          </Card>
        </Main>
      </>
    )
  }

  if (selectedUser) {
    return (
      <>
        <Header>
          <h2 className='text-lg font-semibold me-auto'>Administración de usuarios</h2>
          <ThemeSwitch /><ProfileDropdown />
        </Header>
        <Main>
          <UserAccessPage
            user={selectedUser}
            companies={companies}
            onBack={() => setSelectedUser(null)}
            onChanged={load}
          />
        </Main>
      </>
    )
  }

  return (
    <>
      <Header>
        <h2 className='text-lg font-semibold me-auto'>Administración de usuarios</h2>
        <ThemeSwitch /><ProfileDropdown />
      </Header>
      <Main>
        <Card>
          <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <CardTitle>Usuarios Oracle</CardTitle>
              <CardDescription>
                {total} usuarios · ordenados por {orderBy} {direction}.
              </CardDescription>
            </div>
            <div className='flex flex-wrap gap-2 items-center'>
              <Input
                placeholder='Buscar...'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                className='w-44'
              />
              <Button variant='outline' onClick={applySearch}>Buscar</Button>
              <Select
                value={includeLocked ? 'all' : 'open'}
                onValueChange={(v) => { setIncludeLocked(v === 'all'); setPage(1) }}
              >
                <SelectTrigger className='w-36'><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Todos</SelectItem>
                  <SelectItem value='open'>Solo activos</SelectItem>
                </SelectContent>
              </Select>
              <Button variant='outline' onClick={load} disabled={loading} title='Refrescar'>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <CreateUserDialog onCreated={load} />
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <div className='mb-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700'>
                {error}
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortHeader label='Usuario' field='username' current={orderBy} dir={direction} onChange={changeOrder} />
                  </TableHead>
                  <TableHead>Nombre completo</TableHead>
                  <TableHead>Rol / puesto</TableHead>
                  <TableHead>
                    <SortHeader label='Estado' field='status' current={orderBy} dir={direction} onChange={changeOrder} />
                  </TableHead>
                  <TableHead>
                    <SortHeader label='Creado' field='created' current={orderBy} dir={direction} onChange={changeOrder} />
                  </TableHead>
                  <TableHead className='text-right'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && users.length === 0 && (
                  <TableRow><TableCell colSpan={6} className='text-center py-6'>
                    <Loader2 className='inline h-4 w-4 animate-spin' />
                  </TableCell></TableRow>
                )}
                {!loading && users.length === 0 && (
                  <TableRow><TableCell colSpan={6} className='text-center py-6 text-muted-foreground'>
                    Sin resultados
                  </TableCell></TableRow>
                )}
                {users.map((u) => (
                  <TableRow key={u.username}>
                    <TableCell className='font-mono'>{u.username}</TableCell>
                    <TableCell>{u.full_name || <span className='text-muted-foreground italic'>sin nombre</span>}</TableCell>
                    <TableCell className='text-sm text-muted-foreground'>{u.role || '—'}</TableCell>
                    <TableCell>{statusBadge(u.account_status)}</TableCell>
                    <TableCell className='text-xs text-muted-foreground'>
                      {u.created ? new Date(u.created).toLocaleDateString('es-DO') : '—'}
                    </TableCell>
                    <TableCell className='text-right space-x-1'>
                      <Button size='sm' variant='outline' title='Permisos por módulo'
                        onClick={() => setSelectedUser(u)}>
                        <ShieldCheck className='h-3.5 w-3.5' />
                      </Button>
                      <EditProfileDialog user={u} onDone={load} />
                      <ResetPasswordDialog user={u} onDone={load} />
                      <Button
                        size='sm'
                        variant={u.account_status === 'OPEN' ? 'destructive' : 'default'}
                        onClick={() => toggleLock(u)}
                        title={u.account_status === 'OPEN' ? 'Bloquear' : 'Desbloquear'}
                      >
                        {u.account_status === 'OPEN' ? <Lock className='h-3.5 w-3.5' /> : <Unlock className='h-3.5 w-3.5' />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Paginación */}
            <div className='mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm'>
              <div className='flex items-center gap-2'>
                <span className='text-muted-foreground'>Mostrar</span>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
                  <SelectTrigger className='w-20'><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className='text-muted-foreground'>{range}</span>
              </div>
              <div className='flex items-center gap-1'>
                <Button size='sm' variant='outline' onClick={() => setPage(1)} disabled={page === 1}>
                  <ChevronsLeft className='h-3.5 w-3.5' />
                </Button>
                <Button size='sm' variant='outline' onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className='h-3.5 w-3.5' />
                </Button>
                <span className='px-2 text-muted-foreground'>
                  Página {page} / {totalPages || 1}
                </span>
                <Button size='sm' variant='outline' onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  <ChevronRight className='h-3.5 w-3.5' />
                </Button>
                <Button size='sm' variant='outline' onClick={() => setPage(totalPages)} disabled={page >= totalPages}>
                  <ChevronsRight className='h-3.5 w-3.5' />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
