// Vista dedicada de documentos de empresa (Configuracion > Licitacion) -- reemplaza la
// seccion embebida por empresa en lic-config.tsx: selector de empresa arriba, boton
// "Nuevo documento" con zona de arrastrar-y-soltar + tipo de documento del catalogo, y
// tabla con badge Vigente/Vencido + descarga.
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Download, Plus, Upload } from 'lucide-react'
import { useCompany } from '@/hooks/use-company'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  type DocumentoEmpresa,
  documentoEmpresaDescargarUrl,
  useDocumentosEmpresa,
  useSubirDocumentoEmpresa,
  useTiposDocumento,
} from './api'

function fmtDate(s: string | null): string {
  return s ? String(s).slice(0, 10) : ''
}

export function LicDocumentosEmpresa() {
  const { selectedCompany } = useCompany()
  const [dialogAbierto, setDialogAbierto] = useState(false)
  const { data, isLoading } = useDocumentosEmpresa(selectedCompany)

  const documentos = data?.documentos ?? []

  return (
    <div className='space-y-4'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h3 className='text-base font-semibold'>Documentos de la empresa {selectedCompany}</h3>
          <p className='text-sm text-muted-foreground'>
            RNC, constancias, actas y demás documentos usados para evaluar automáticamente si
            la empresa cumple los requisitos de cada licitación.
          </p>
        </div>
        <Button size='sm' className='gap-1.5 shrink-0' onClick={() => setDialogAbierto(true)}>
          <Plus className='h-4 w-4' />
          Nuevo documento
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className='h-40 w-full' />
      ) : documentos.length === 0 ? (
        <p className='text-sm text-muted-foreground py-4'>
          Aún no se han subido documentos para esta empresa.
        </p>
      ) : (
        <div className='rounded-md border overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Archivo</TableHead>
                <TableHead className='w-20'>Punto</TableHead>
                <TableHead className='w-40'>Vencimiento</TableHead>
                <TableHead className='w-16 text-right'>Descargar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documentos.map((d) => (
                <DocumentoRow key={d.id} documento={d} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <NuevoDocumentoDialog
        noCia={selectedCompany}
        open={dialogAbierto}
        onOpenChange={setDialogAbierto}
      />
    </div>
  )
}

function DocumentoRow({ documento: d }: { documento: DocumentoEmpresa }) {
  return (
    <TableRow>
      <TableCell className='text-sm'>{d.tipo_documento_nombre ?? d.descripcion ?? 'Sin tipo'}</TableCell>
      <TableCell className='text-sm truncate max-w-xs'>{d.nombre_archivo}</TableCell>
      <TableCell className='text-sm'>{d.punto ?? '—'}</TableCell>
      <TableCell>
        {d.fecha_vencimiento ? (
          <Badge variant={d.vencido ? 'destructive' : 'outline'}>
            {d.vencido ? 'Vencido' : 'Vigente'} · {fmtDate(d.fecha_vencimiento)}
          </Badge>
        ) : (
          <span className='text-xs text-muted-foreground'>Sin vencimiento</span>
        )}
      </TableCell>
      <TableCell className='text-right'>
        <Button size='sm' variant='ghost' asChild title='Descargar'>
          <a href={documentoEmpresaDescargarUrl(d.id)} target='_blank' rel='noreferrer'>
            <Download className='h-4 w-4' />
          </a>
        </Button>
      </TableCell>
    </TableRow>
  )
}

function NuevoDocumentoDialog({
  noCia,
  open,
  onOpenChange,
}: {
  noCia: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { data: tiposData } = useTiposDocumento()
  const subir = useSubirDocumentoEmpresa()
  const fileRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [tipoDocumentoId, setTipoDocumentoId] = useState<string>('')
  const [punto, setPunto] = useState('')
  const [fechaVencimiento, setFechaVencimiento] = useState('')

  const tipos = (tiposData?.tipos ?? []).filter((t) => t.activo === 'S')

  const reset = () => {
    setArchivo(null)
    setTipoDocumentoId('')
    setPunto('')
    setFechaVencimiento('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSubir = () => {
    if (!archivo) {
      toast.error('Seleccione un archivo')
      return
    }
    subir.mutate(
      {
        no_cia: noCia,
        archivo,
        punto: punto || undefined,
        fecha_vencimiento: fechaVencimiento || undefined,
        tipo_documento_id: tipoDocumentoId ? Number(tipoDocumentoId) : undefined,
      },
      {
        onSuccess: () => {
          toast.success('Documento guardado')
          reset()
          onOpenChange(false)
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>Nuevo documento</DialogTitle>
          <DialogDescription>
            Para la empresa {noCia}. Arrastre el archivo o selecciónelo manualmente.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-3'>
          <div
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault()
              setArrastrando(false)
              const f = e.dataTransfer.files?.[0]
              if (f) setArchivo(f)
            }}
            onClick={() => fileRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
              arrastrando ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
          >
            <Upload className='h-6 w-6 text-muted-foreground' />
            <p className='text-sm text-muted-foreground'>
              {archivo ? archivo.name : 'Arrastre un archivo aquí o haga clic para seleccionar'}
            </p>
            <input
              ref={fileRef}
              type='file'
              className='hidden'
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
          </div>

          <div>
            <Label className='text-xs'>Tipo de documento</Label>
            <Select value={tipoDocumentoId} onValueChange={setTipoDocumentoId}>
              <SelectTrigger className='h-9'>
                <SelectValue placeholder='Seleccione un tipo' />
              </SelectTrigger>
              <SelectContent>
                {tipos.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='flex gap-3'>
            <div>
              <Label className='text-xs'>Punto (opcional)</Label>
              <Input
                value={punto}
                onChange={(e) => setPunto(e.target.value)}
                className='h-9 w-24'
                maxLength={2}
              />
            </div>
            <div className='grow'>
              <Label className='text-xs'>Fecha de vencimiento</Label>
              <Input
                type='date'
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                className='h-9'
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant='ghost' onClick={() => onOpenChange(false)} disabled={subir.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubir} disabled={subir.isPending}>
            {subir.isPending ? 'Subiendo…' : 'Subir documento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
