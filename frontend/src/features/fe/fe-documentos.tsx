// Bitácora de e-CF enviados a la DGII (TFE_DOCUMENTO) — Fase 2, Task 4.
// Tabla paginada con acciones por fila: ver XML firmado, ver respuesta
// DGII, consultar estado, reenviar (si fue rechazado).
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  ESTADOS_DOCUMENTO,
  TIPOS_ECF,
  useConsultarEstado,
  useFeDocumento,
  useFeDocumentos,
  useReenviarDocumento,
} from '@/features/fe/api'

const PAGE_SIZE = 25

const fmtDate = (s: string | null) => (s ? s.slice(0, 16).replace('T', ' ') : '—')

function estadoBadgeVariant(estado: string) {
  const e = (estado || '').toUpperCase()
  if (e.startsWith('ACEPTADO')) return 'default' as const
  if (e === 'RECHAZADO') return 'destructive' as const
  if (e === 'ENVIADO' || e === 'EN PROCESO') return 'secondary' as const
  return 'outline' as const
}

export function FeDocumentos({ noCia }: { noCia: string }) {
  const [page, setPage] = useState(0)
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroPrueba, setFiltroPrueba] = useState('N') // por defecto: solo producción real
  const [verDialog, setVerDialog] = useState<{
    eNcf: string
    tipo: 'xml' | 'respuesta'
  } | null>(null)

  const filtros = {
    estado: filtroEstado === 'todos' ? undefined : filtroEstado,
    tipo_ecf: filtroTipo === 'todos' ? undefined : filtroTipo,
    es_prueba: filtroPrueba === 'todos' ? undefined : filtroPrueba,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }
  const { data, isLoading, isFetching } = useFeDocumentos(noCia, filtros)
  const items = data?.items ?? []

  const consultarEstado = useConsultarEstado(noCia)
  const reenviar = useReenviarDocumento(noCia)

  const onConsultarEstado = (eNcf: string) => {
    consultarEstado.mutate(eNcf, {
      onSuccess: (r) =>
        toast.success(`e-NCF ${eNcf}: estado ${ESTADOS_DOCUMENTO[r.estado] ?? r.estado}`),
      onError: (e: any) => toast.error(e.message),
    })
  }

  const onReenviar = (eNcf: string) => {
    reenviar.mutate(eNcf, {
      onSuccess: () => toast.success(`e-NCF ${eNcf} reenviado a la DGII`),
      onError: (e: any) => toast.error(e.message),
    })
  }

  return (
    <div className='space-y-4'>
      <div>
        <h3 className='text-base font-semibold'>Comprobantes Electrónicos enviados</h3>
        <p className='text-muted-foreground text-sm'>
          Bitácora de e-CF firmados y enviados a la DGII (tabla{' '}
          <code className='text-xs'>FAT.TFE_DOCUMENTO</code>). Consulte el
          estado de validación o reenvíe un comprobante rechazado.
        </p>
      </div>

      <div className='flex flex-wrap items-end gap-3'>
        <div>
          <Label className='text-xs'>Estado</Label>
          <Select
            value={filtroEstado}
            onValueChange={(v) => {
              setFiltroEstado(v)
              setPage(0)
            }}
          >
            <SelectTrigger className='h-9 w-44'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='todos'>Todos</SelectItem>
              {Object.entries(ESTADOS_DOCUMENTO).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className='text-xs'>Tipo de e-CF</Label>
          <Select
            value={filtroTipo}
            onValueChange={(v) => {
              setFiltroTipo(v)
              setPage(0)
            }}
          >
            <SelectTrigger className='h-9 w-56'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='todos'>Todos</SelectItem>
              {Object.entries(TIPOS_ECF).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {k} — {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className='text-xs'>Origen</Label>
          <Select
            value={filtroPrueba}
            onValueChange={(v) => {
              setFiltroPrueba(v)
              setPage(0)
            }}
          >
            <SelectTrigger className='h-9 w-52'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='N'>Solo producción real</SelectItem>
              <SelectItem value='S'>Solo Set de Pruebas DGII</SelectItem>
              <SelectItem value='todos'>Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isFetching && !isLoading && (
          <span className='text-muted-foreground text-xs'>Actualizando…</span>
        )}
      </div>

      {isLoading ? (
        <Skeleton className='h-64 w-full' />
      ) : (
        <div className='overflow-x-auto rounded border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>e-NCF</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Fecha firma</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>TrackId</TableHead>
                <TableHead className='text-right'>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((d) => (
                <TableRow key={d.e_ncf}>
                  <TableCell className='font-mono text-sm'>
                    <div className='flex items-center gap-2'>
                      {d.e_ncf}
                      {d.es_prueba === 'S' && (
                        <Badge
                          variant='outline'
                          className='border-amber-500 text-amber-600 dark:text-amber-400'
                        >
                          PRUEBA
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {d.tipo_ecf} — {TIPOS_ECF[d.tipo_ecf] ?? ''}
                  </TableCell>
                  <TableCell>{fmtDate(d.fecha_firma)}</TableCell>
                  <TableCell>
                    <Badge variant={estadoBadgeVariant(d.estado)}>
                      {ESTADOS_DOCUMENTO[d.estado] ?? d.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className='font-mono text-xs'>
                    {d.track_id ?? '—'}
                  </TableCell>
                  <TableCell>
                    <div className='flex flex-wrap justify-end gap-1'>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => setVerDialog({ eNcf: d.e_ncf, tipo: 'xml' })}
                      >
                        Ver XML
                      </Button>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() =>
                          setVerDialog({ eNcf: d.e_ncf, tipo: 'respuesta' })
                        }
                      >
                        Ver respuesta
                      </Button>
                      <Button
                        size='sm'
                        variant='outline'
                        disabled={consultarEstado.isPending || !d.track_id}
                        title={
                          d.track_id
                            ? undefined
                            : 'Este documento no tiene trackId (no fue enviado a la DGII)'
                        }
                        onClick={() => onConsultarEstado(d.e_ncf)}
                      >
                        {consultarEstado.isPending &&
                        consultarEstado.variables === d.e_ncf
                          ? 'Consultando…'
                          : 'Consultar estado'}
                      </Button>
                      {d.estado?.toUpperCase() === 'RECHAZADO' && (
                        <Button
                          size='sm'
                          disabled={reenviar.isPending}
                          onClick={() => onReenviar(d.e_ncf)}
                        >
                          {reenviar.isPending && reenviar.variables === d.e_ncf
                            ? 'Reenviando…'
                            : 'Reenviar'}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className='text-muted-foreground py-6 text-center'>
                    No hay comprobantes electrónicos para el filtro actual.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className='flex items-center justify-end gap-2 text-sm'>
        <Button
          size='sm'
          variant='outline'
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          Anterior
        </Button>
        <span className='text-muted-foreground'>Página {page + 1}</span>
        <Button
          size='sm'
          variant='outline'
          disabled={items.length < PAGE_SIZE}
          onClick={() => setPage((p) => p + 1)}
        >
          Siguiente
        </Button>
      </div>

      <DocumentoDetalleDialog
        noCia={noCia}
        eNcf={verDialog?.eNcf ?? null}
        tipo={verDialog?.tipo ?? null}
        onClose={() => setVerDialog(null)}
      />
    </div>
  )
}

function DocumentoDetalleDialog({
  noCia,
  eNcf,
  tipo,
  onClose,
}: {
  noCia: string
  eNcf: string | null
  tipo: 'xml' | 'respuesta' | null
  onClose: () => void
}) {
  const { data, isLoading } = useFeDocumento(noCia, eNcf)
  const doc = data?.documento

  let contenido = ''
  if (doc) {
    if (tipo === 'xml') {
      contenido = doc.xml_firmado ?? '(este documento no tiene XML firmado guardado)'
    } else if (tipo === 'respuesta') {
      try {
        contenido = doc.respuesta_dgii
          ? JSON.stringify(JSON.parse(doc.respuesta_dgii), null, 2)
          : '(sin respuesta de la DGII registrada)'
      } catch {
        contenido = doc.respuesta_dgii ?? ''
      }
    }
  }

  return (
    <Dialog open={!!eNcf && !!tipo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className='max-h-[80vh] max-w-3xl overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>
            {tipo === 'xml' ? 'XML firmado' : 'Respuesta de la DGII'} — {eNcf}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className='h-48 w-full' />
        ) : (
          <pre className='bg-muted max-h-[60vh] overflow-auto rounded p-3 text-xs whitespace-pre-wrap break-all'>
            {contenido}
          </pre>
        )}
      </DialogContent>
    </Dialog>
  )
}
