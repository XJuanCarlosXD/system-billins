// CRUD del catalogo de tipos de documento de empresa (Configuracion > Licitacion) --
// permite agregar tipos nuevos a futuro sin tocar codigo (ej. "Certificado de No Deuda").
import { useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  type TipoDocumento,
  useActualizarTipoDocumento,
  useCrearTipoDocumento,
  useTiposDocumento,
} from './api'

export function LicTiposDocumento() {
  const { data, isLoading } = useTiposDocumento()
  const crear = useCrearTipoDocumento()
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')

  const handleCrear = () => {
    if (!codigo.trim() || !nombre.trim()) {
      toast.error('Código y nombre son requeridos')
      return
    }
    crear.mutate(
      { codigo: codigo.trim().toUpperCase(), nombre: nombre.trim() },
      {
        onSuccess: () => {
          toast.success(`Tipo de documento "${nombre.trim()}" creado`)
          setCodigo('')
          setNombre('')
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  const tipos = data?.tipos ?? []

  return (
    <div className='space-y-4'>
      <div>
        <h3 className='text-base font-semibold'>Tipos de documento</h3>
        <p className='text-sm text-muted-foreground'>
          Catálogo de tipos de documento que se pueden subir para una empresa (RNC,
          constancias, actas, etc.). Agregue uno nuevo aquí antes de que aparezca como
          opción al subir un documento.
        </p>
      </div>

      <div className='flex flex-wrap items-end gap-3'>
        <div>
          <Label className='text-xs'>Código</Label>
          <Input
            placeholder='EJ. NODEUDA'
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className='h-9 w-40'
            maxLength={30}
          />
        </div>
        <div className='grow max-w-sm'>
          <Label className='text-xs'>Nombre</Label>
          <Input
            placeholder='Ej. Certificado de No Deuda'
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className='h-9'
            maxLength={200}
          />
        </div>
        <Button size='sm' className='gap-1.5' disabled={crear.isPending} onClick={handleCrear}>
          <Plus className='h-4 w-4' />
          {crear.isPending ? 'Creando…' : 'Nuevo tipo'}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className='h-40 w-full' />
      ) : (
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className='w-28'>Estado</TableHead>
                <TableHead className='w-32 text-right'>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tipos.map((t) => (
                <TipoDocumentoRow key={t.id} tipo={t} />
              ))}
              {tipos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className='text-center text-muted-foreground py-6'>
                    No hay tipos de documento todavía.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function TipoDocumentoRow({ tipo }: { tipo: TipoDocumento }) {
  const actualizar = useActualizarTipoDocumento()

  return (
    <TableRow>
      <TableCell className='font-mono text-xs'>{tipo.codigo}</TableCell>
      <TableCell className='text-sm'>{tipo.nombre}</TableCell>
      <TableCell>
        <Badge variant={tipo.activo === 'S' ? 'default' : 'outline'}>
          {tipo.activo === 'S' ? 'Activo' : 'Inactivo'}
        </Badge>
      </TableCell>
      <TableCell className='text-right'>
        <Button
          size='sm'
          variant='ghost'
          disabled={actualizar.isPending}
          onClick={() =>
            actualizar.mutate(
              { id: tipo.id, activo: tipo.activo === 'S' ? 'N' : 'S' },
              { onError: (e) => toast.error(e.message) }
            )
          }
        >
          {tipo.activo === 'S' ? 'Desactivar' : 'Activar'}
        </Button>
      </TableCell>
    </TableRow>
  )
}
