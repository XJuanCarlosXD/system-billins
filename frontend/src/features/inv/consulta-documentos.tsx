import { useEffect, useState } from 'react'
import { X, FileText, ExternalLink, ChevronRight } from 'lucide-react'
import { useCompany } from '@/context/company-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface Documento {
  tipo_docu: string
  no_docu: string | number
  fecha?: string
  almacen?: string
  desc_almacen?: string
  estado?: string
  total?: number
  [key: string]: any
}

interface DocumentoDetalle {
  header: Record<string, any>
  lineas: Array<Record<string, any>>
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function estadoBadge(estado: string | undefined) {
  if (!estado) return <Badge variant='outline'>—</Badge>
  const u = estado.toUpperCase()
  if (u === 'A' || u === 'APLICADO' || u === 'AUTORIZADO')
    return <Badge className='bg-green-600 text-white text-xs'>{estado}</Badge>
  if (u === 'P' || u === 'PENDIENTE')
    return <Badge variant='secondary' className='text-xs'>{estado}</Badge>
  if (u === 'N' || u === 'ANULADO')
    return <Badge variant='destructive' className='text-xs'>{estado}</Badge>
  return <Badge variant='outline' className='text-xs'>{estado}</Badge>
}

function fmt(n?: number) {
  return n == null
    ? '—'
    : n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(s?: string) {
  if (!s) return '—'
  return s.slice(0, 10)
}

export function ConsultaDocumentos() {
  const { selectedCompany } = useCompany()
  const noCia = selectedCompany || '01'

  const today = new Date()
  const thirtyAgo = new Date(today)
  thirtyAgo.setDate(today.getDate() - 30)

  const [tipoDocu, setTipoDocu] = useState('__all__')
  const [almacen, setAlmacen] = useState('__all__')
  const [desde, setDesde] = useState(toInputDate(thirtyAgo))
  const [hasta, setHasta] = useState(toInputDate(today))
  const [estado, setEstado] = useState('__all__')

  const [tiposDocu, setTiposDocu] = useState<any[]>([])
  const [almacenes, setAlmacenes] = useState<any[]>([])
  const [rows, setRows] = useState<Documento[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [detalle, setDetalle] = useState<DocumentoDetalle | null>(null)
  const [detalleLoading, setDetalleLoading] = useState(false)
  const [detalleDoc, setDetalleDoc] = useState<Documento | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Load catalogs once
  useEffect(() => {
    if (!noCia) return
    apiFetch<any>(`/inv/tipos-docu/?no_cia=${noCia}`)
      .then((d) => setTiposDocu(Array.isArray(d) ? d : d.items ?? d.results ?? []))
      .catch(() => setTiposDocu([]))

    apiFetch<any>(`/inv/almacenes/?no_cia=${noCia}`)
      .then((d) => setAlmacenes(Array.isArray(d) ? d : d.items ?? d.results ?? []))
      .catch(() => setAlmacenes([]))
  }, [noCia])

  // Load documents
  useEffect(() => {
    if (!noCia) return
    setLoading(true)
    setError('')
    const qs = new URLSearchParams({ no_cia: noCia })
    if (tipoDocu && tipoDocu !== '__all__') qs.set('tipo_docu', tipoDocu)
    if (almacen && almacen !== '__all__') qs.set('almacen', almacen)
    if (desde) qs.set('desde', desde)
    if (hasta) qs.set('hasta', hasta)
    if (estado && estado !== '__all__') qs.set('estado', estado)

    apiFetch<any>(`/inv/documentos/?${qs}`)
      .then((d) => setRows(Array.isArray(d) ? d : d.items ?? d.results ?? []))
      .catch((e) => setError(e.message ?? 'Error al cargar documentos'))
      .finally(() => setLoading(false))
  }, [noCia, tipoDocu, almacen, desde, hasta, estado])

  function openDetalle(doc: Documento) {
    setDetalleDoc(doc)
    setDetalle(null)
    setSheetOpen(true)
    setDetalleLoading(true)
    apiFetch<any>(`/inv/documentos/${doc.tipo_docu}/${doc.no_docu}/?no_cia=${noCia}`)
      .then((d) => setDetalle(d))
      .catch(() => setDetalle({ header: {}, lineas: [] }))
      .finally(() => setDetalleLoading(false))
  }

  function openPdf(doc: Documento, e: React.MouseEvent) {
    e.stopPropagation()
    const url = `${API_BASE}/inv/documentos/${doc.tipo_docu}/${doc.no_docu}/pdf/?no_cia=${noCia}`
    window.open(url, '_blank')
  }

  const reset = () => {
    setTipoDocu('__all__')
    setAlmacen('__all__')
    setDesde(toInputDate(thirtyAgo))
    setHasta(toInputDate(today))
    setEstado('__all__')
  }

  const hasFilters =
    tipoDocu !== '__all__' || almacen !== '__all__' || estado !== '__all__'

  return (
    <div className='space-y-4'>
      <div>
        <h2 className='text-lg font-semibold'>Consulta de Documentos</h2>
        <p className='text-sm text-muted-foreground'>
          Buscar documentos de inventario por tipo, almacén y período
        </p>
      </div>

      {/* Filters */}
      <div className='flex flex-wrap gap-2 items-end'>
        <Select value={tipoDocu} onValueChange={setTipoDocu}>
          <SelectTrigger className='h-9 w-[180px]'>
            <SelectValue placeholder='Tipo Documento' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='__all__'>Todos los tipos</SelectItem>
            {tiposDocu.map((t: any) => {
              const key = t.tipo_docu ?? t.codigo ?? t.id
              return (
                <SelectItem key={key} value={String(key)}>
                  {key}{t.descripcion ? ` - ${t.descripcion}` : ''}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        <Select value={almacen} onValueChange={setAlmacen}>
          <SelectTrigger className='h-9 w-[180px]'>
            <SelectValue placeholder='Almacén' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='__all__'>Todos los almacenes</SelectItem>
            {almacenes.map((a: any) => {
              const key = a.almacen ?? a.codigo ?? a.id
              return (
                <SelectItem key={key} value={String(key)}>
                  {a.descripcion ?? a.desc_almacen ?? key}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        <div className='flex items-center gap-1'>
          <label className='text-xs text-muted-foreground whitespace-nowrap'>Desde:</label>
          <Input
            type='date'
            className='h-9 w-[140px] text-sm'
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </div>
        <div className='flex items-center gap-1'>
          <label className='text-xs text-muted-foreground whitespace-nowrap'>Hasta:</label>
          <Input
            type='date'
            className='h-9 w-[140px] text-sm'
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>

        <Select value={estado} onValueChange={setEstado}>
          <SelectTrigger className='h-9 w-[150px]'>
            <SelectValue placeholder='Estado' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='__all__'>Todos los estados</SelectItem>
            <SelectItem value='P'>Pendiente</SelectItem>
            <SelectItem value='A'>Aplicado</SelectItem>
            <SelectItem value='N'>Anulado</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant='ghost' size='sm' className='h-9 gap-1' onClick={reset}>
            <X className='h-3.5 w-3.5' /> Limpiar
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className='rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive'>
          {error}
        </div>
      )}

      {/* Table */}
      <div className='rounded-md border overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-[100px]'>Tipo Doc</TableHead>
              <TableHead className='w-[130px]'>No. Documento</TableHead>
              <TableHead className='w-[110px]'>Fecha</TableHead>
              <TableHead>Almacén</TableHead>
              <TableHead className='w-[100px] text-center'>Estado</TableHead>
              <TableHead className='text-right w-[130px]'>Total</TableHead>
              <TableHead className='w-[100px] text-center'>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>
                  Cargando...
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>
                  No se encontraron documentos
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.map((r, idx) => (
              <TableRow
                key={`${r.tipo_docu}-${r.no_docu}-${idx}`}
                className='cursor-pointer hover:bg-muted/50'
                onClick={() => openDetalle(r)}
              >
                <TableCell>
                  <span className='rounded bg-muted px-1.5 py-0.5 text-xs font-mono font-medium'>
                    {r.tipo_docu}
                  </span>
                </TableCell>
                <TableCell className='font-mono text-xs'>{r.no_docu}</TableCell>
                <TableCell className='text-xs tabular-nums'>{fmtDate(r.fecha)}</TableCell>
                <TableCell className='text-xs text-muted-foreground'>
                  {r.desc_almacen ?? r.almacen ?? '—'}
                </TableCell>
                <TableCell className='text-center'>{estadoBadge(r.estado)}</TableCell>
                <TableCell className='text-right font-mono text-xs font-medium'>
                  {fmt(r.total)}
                </TableCell>
                <TableCell className='text-center'>
                  <div className='flex items-center justify-center gap-1'>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-7 w-7'
                      title='Ver detalle'
                      onClick={(e) => { e.stopPropagation(); openDetalle(r) }}
                    >
                      <ChevronRight className='h-3.5 w-3.5' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-7 w-7'
                      title='Abrir PDF'
                      onClick={(e) => openPdf(r, e)}
                    >
                      <ExternalLink className='h-3.5 w-3.5' />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {!loading && rows.length > 0 && (
        <p className='text-xs text-muted-foreground text-right'>
          {rows.length} documentos mostrados
        </p>
      )}

      {/* Detail Side Panel */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className='max-w-[70vw] max-h-[70vh] overflow-y-auto'>
          <SheetHeader>
            <SheetTitle className='flex items-center gap-2'>
              <FileText className='h-5 w-5' />
              {detalleDoc
                ? `${detalleDoc.tipo_docu} / ${detalleDoc.no_docu}`
                : 'Detalle de Documento'}
            </SheetTitle>
          </SheetHeader>

          {detalleLoading && (
            <div className='py-10 text-center text-muted-foreground text-sm'>
              Cargando detalle...
            </div>
          )}

          {!detalleLoading && detalle && (
            <div className='space-y-4 mt-4'>
              {/* Header info */}
              <div className='rounded-md border p-4 space-y-2 text-sm'>
                {detalleDoc && (
                  <>
                    <div className='grid grid-cols-2 gap-x-4 gap-y-1'>
                      <span className='text-muted-foreground'>Tipo Doc:</span>
                      <span className='font-mono font-medium'>{detalleDoc.tipo_docu}</span>
                      <span className='text-muted-foreground'>No. Documento:</span>
                      <span className='font-mono font-medium'>{detalleDoc.no_docu}</span>
                      <span className='text-muted-foreground'>Fecha:</span>
                      <span>{fmtDate(detalleDoc.fecha)}</span>
                      <span className='text-muted-foreground'>Almacén:</span>
                      <span>{detalleDoc.desc_almacen ?? detalleDoc.almacen ?? '—'}</span>
                      <span className='text-muted-foreground'>Estado:</span>
                      <span>{estadoBadge(detalleDoc.estado)}</span>
                      <span className='text-muted-foreground'>Total:</span>
                      <span className='font-mono font-semibold'>{fmt(detalleDoc.total)}</span>
                    </div>
                  </>
                )}
                {/* Extra header fields from API */}
                {Object.entries(detalle.header ?? {}).map(([k, v]) => {
                  if (['tipo_docu','no_docu','fecha','almacen','desc_almacen','estado','total'].includes(k)) return null
                  return (
                    <div key={k} className='grid grid-cols-2 gap-x-4'>
                      <span className='text-muted-foreground capitalize'>{k.replace(/_/g, ' ')}:</span>
                      <span className='font-mono text-xs'>{String(v ?? '—')}</span>
                    </div>
                  )
                })}
              </div>

              {/* PDF button */}
              {detalleDoc && (
                <Button
                  variant='outline'
                  size='sm'
                  className='gap-2'
                  onClick={(e) => openPdf(detalleDoc, e)}
                >
                  <ExternalLink className='h-4 w-4' />
                  Abrir PDF
                </Button>
              )}

              {/* Line items */}
              {detalle.lineas && detalle.lineas.length > 0 && (
                <div>
                  <h4 className='text-sm font-semibold mb-2'>Líneas del Documento</h4>
                  <div className='rounded-md border overflow-x-auto'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(detalle.lineas[0]).map((col) => (
                            <TableHead key={col} className='text-xs whitespace-nowrap'>
                              {col.replace(/_/g, ' ').toUpperCase()}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detalle.lineas.map((line, i) => (
                          <TableRow key={i}>
                            {Object.values(line).map((val, j) => (
                              <TableCell key={j} className='text-xs font-mono'>
                                {typeof val === 'number'
                                  ? val.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                  : String(val ?? '—')}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {(!detalle.lineas || detalle.lineas.length === 0) && (
                <p className='text-sm text-muted-foreground'>No hay líneas de detalle disponibles.</p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
