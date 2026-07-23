// Configuración de LIC (Licitaciones) — credenciales del portal DGCP por empresa
// y PDF de rubros RPE usado para clasificar oportunidades. Equivale a la pantalla de
// configuración de apps.lic (Task 10 backend) — no existe forma legacy Oracle Forms
// (módulo nuevo del clon).
import { useRef, useState } from 'react'
import { Eye, Plus, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type Credencial,
  type Rubro,
  useCredenciales,
  useGuardarCredencial,
  useProbarConexion,
  useRubros,
  useSubirRubrosPdf,
} from './api'

const RUBROS_PAGE_SIZE = 10

function fmtDate(s: string | null): string {
  return s ? String(s).slice(0, 10) : ''
}

export function LicConfig() {
  const { data, isLoading } = useCredenciales()
  const guardarCredencial = useGuardarCredencial()

  const [mostrarForm, setMostrarForm] = useState(false)
  const [noCia, setNoCia] = useState('')
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')

  const guardar = () => {
    if (!noCia.trim() || !usuario.trim() || !password.trim()) {
      toast.error('No. Cía, usuario y contraseña del portal son requeridos')
      return
    }
    guardarCredencial.mutate(
      { no_cia: noCia.trim(), usuario_portal: usuario.trim(), password },
      {
        onSuccess: () => {
          toast.success(`Credencial guardada para la empresa ${noCia.trim()}`)
          setNoCia('')
          setUsuario('')
          setPassword('')
          setMostrarForm(false)
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h3 className='text-base font-semibold'>Configuración del portal DGCP</h3>
          <p className='text-sm text-muted-foreground'>
            Credenciales de acceso al portal de Compras y Contrataciones (DGCP) por
            empresa, usadas por la búsqueda automática de licitaciones, y el PDF de
            rubros RPE que clasifica las oportunidades encontradas.
          </p>
        </div>
        {!mostrarForm && (
          <Button
            type='button'
            size='sm'
            className='gap-1.5 shrink-0'
            onClick={() => setMostrarForm(true)}
          >
            <Plus className='h-4 w-4' />
            Nueva credencial de portal
          </Button>
        )}
      </div>

      {mostrarForm && (
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>Nueva credencial de portal</CardTitle>
          <CardDescription>
            El usuario y la contraseña son los mismos que se usan para entrar al
            portal de licitaciones de la DGCP con esta empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-wrap items-end gap-3'>
          <div>
            <Label className='text-xs'>
              No. Cía <span className='text-destructive'>*</span>
            </Label>
            <Input
              placeholder='01'
              value={noCia}
              onChange={(e) => setNoCia(e.target.value)}
              className='h-9 w-20'
              maxLength={2}
            />
          </div>
          <div className='grow max-w-xs'>
            <Label className='text-xs'>
              Usuario del portal <span className='text-destructive'>*</span>
            </Label>
            <Input
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className='h-9'
            />
          </div>
          <div className='grow max-w-xs'>
            <Label className='text-xs'>
              Contraseña <span className='text-destructive'>*</span>
            </Label>
            <Input
              type='password'
              autoComplete='new-password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className='h-9'
            />
          </div>
          <Button onClick={guardar} disabled={guardarCredencial.isPending}>
            {guardarCredencial.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button
            type='button'
            variant='ghost'
            disabled={guardarCredencial.isPending}
            onClick={() => setMostrarForm(false)}
          >
            Cancelar
          </Button>
        </CardContent>
      </Card>
      )}

      {isLoading ? (
        <Skeleton className='h-40 w-full' />
      ) : !data?.credenciales.length ? (
        <p className='text-muted-foreground text-sm'>
          No hay empresas configuradas todavía. Agregue una credencial arriba para
          empezar a buscar licitaciones de esa empresa en el portal DGCP.
        </p>
      ) : (
        data.credenciales.map((c) => <EmpresaCard key={c.no_cia} credencial={c} />)
      )}
    </div>
  )
}

function EmpresaCard({ credencial }: { credencial: Credencial }) {
  const { no_cia, usuario_portal, estado, ultimo_login_ok, ultimo_error } = credencial
  const probarConexion = useProbarConexion()
  const { data: rubrosData, isLoading: rubrosLoading } = useRubros(no_cia)
  const subirRubros = useSubirRubrosPdf()
  const fileRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)

  const handleSubirRubros = () => {
    if (!archivo) return
    subirRubros.mutate(
      { no_cia, archivo },
      {
        onSuccess: (r) => {
          toast.success(`Rubros extraídos: ${r.rubros.length} encontrados`)
          setArchivo(null)
          if (fileRef.current) fileRef.current.value = ''
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  return (
    <Card>
      <CardHeader className='flex-row items-center justify-between pb-2'>
        <div>
          <CardTitle className='text-base'>Empresa {no_cia}</CardTitle>
          <CardDescription>Usuario: {usuario_portal}</CardDescription>
        </div>
        <Badge variant={estado === 'activo' ? 'default' : 'destructive'}>
          {estado === 'activo' ? 'Activo' : 'Error de acceso'}
        </Badge>
      </CardHeader>
      <CardContent className='space-y-3'>
        {estado === 'error_login' && ultimo_error && (
          <p className='text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2'>
            {ultimo_error}
          </p>
        )}
        {ultimo_login_ok && (
          <p className='text-xs text-muted-foreground'>
            Último acceso exitoso: {fmtDate(ultimo_login_ok)}
          </p>
        )}

        <Button
          variant='outline'
          size='sm'
          disabled={probarConexion.isPending}
          onClick={() =>
            probarConexion.mutate(no_cia, {
              onSuccess: () =>
                toast.success(`Conexión exitosa para la empresa ${no_cia}`),
              onError: (e) => toast.error(e.message),
            })
          }
        >
          {probarConexion.isPending ? 'Probando…' : 'Probar conexión'}
        </Button>

        <div className='space-y-1.5'>
          <Label className='text-xs'>PDF de rubros RPE</Label>
          <div className='flex items-center gap-3'>
            <Input
              ref={fileRef}
              type='file'
              accept='application/pdf'
              className='h-9 max-w-sm'
              disabled={subirRubros.isPending}
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
            {archivo && (
              <Badge variant='outline' className='text-xs max-w-xs truncate'>
                {archivo.name}
              </Badge>
            )}
            <Button
              variant='secondary'
              size='sm'
              className='gap-2'
              disabled={!archivo || subirRubros.isPending}
              onClick={handleSubirRubros}
            >
              <Upload className='h-4 w-4' />
              {subirRubros.isPending ? 'Subiendo…' : 'Subir'}
            </Button>
          </div>

          {rubrosLoading ? (
            <Skeleton className='h-16 w-full' />
          ) : rubrosData?.rubros.length ? (
            <RubrosTable rubros={rubrosData.rubros} />
          ) : (
            <p className='text-xs text-muted-foreground'>
              Aún no se han cargado rubros para esta empresa.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function RubrosTable({ rubros }: { rubros: Rubro[] }) {
  const [page, setPage] = useState(1)
  const [seleccionado, setSeleccionado] = useState<Rubro | null>(null)
  const totalPages = Math.max(1, Math.ceil(rubros.length / RUBROS_PAGE_SIZE))
  const paginados = rubros.slice(
    (page - 1) * RUBROS_PAGE_SIZE,
    page * RUBROS_PAGE_SIZE
  )

  return (
    <div className='mt-2 space-y-2'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-28'>Código</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className='w-16 text-right'>Detalles</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginados.map((r, i) => (
            <TableRow
              key={r.codigo ?? `${page}-${i}`}
              className='cursor-pointer hover:bg-muted/50'
              onClick={() => setSeleccionado(r)}
            >
              <TableCell className='font-mono text-xs'>
                {r.codigo ?? '—'}
              </TableCell>
              <TableCell className='text-sm'>{r.descripcion}</TableCell>
              <TableCell
                className='text-right'
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  size='sm'
                  variant='ghost'
                  title='Ver detalles'
                  onClick={() => setSeleccionado(r)}
                >
                  <Eye className='h-4 w-4' />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className='flex items-center justify-between text-sm'>
          <span className='text-muted-foreground'>
            Página {page} de {totalPages} ({rubros.length} rubros)
          </span>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant='outline'
              size='sm'
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={!!seleccionado}
        onOpenChange={(open) => {
          if (!open) setSeleccionado(null)
        }}
      >
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Rubro {seleccionado?.codigo ?? ''}</DialogTitle>
            <DialogDescription>
              Categoría UNSPSC extraída del certificado RPE de esta empresa.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-2 text-sm'>
            <div>
              <span className='text-muted-foreground'>Código: </span>
              {seleccionado?.codigo ?? 'No especificado'}
            </div>
            <div>
              <span className='text-muted-foreground'>Descripción: </span>
              {seleccionado?.descripcion}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
