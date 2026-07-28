// CxP — Corregir NCF / datos DGII de un documento (equivale a Fcxp212).
// Busca los documentos de un proveedor y permite corregir NCF, RNC,
// ITBIS y clasificaciones DGII sin tocar valores ni saldos.
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Save, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { regalGeneralApi as api } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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
import { ProveedorPicker } from './cxp-procesos'

interface P {
  noCia: string
  punto?: string
}

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const TIPOS_NCF = ['B01', 'B02', 'B03', 'B04', 'B11', 'B13', 'B14', 'B15', 'E31', 'E32']

// NCF DGI real: prefijo + LPAD(ncf). B01..B15 usan 8 dígitos (total 11);
// e-CF (E31/E32) usan 10 dígitos (total 13).
const ncfWidth = (pos: string): number => (pos.startsWith('E') ? 10 : 8)
const ncfDgi = (doc: any): string => {
  const pos = (doc?.posiciones_fijas_ncf ?? '').toString().trim().toUpperCase()
  const n = doc?.ncf
  if (!pos || n == null || n === '') return ''
  return pos + String(n).padStart(ncfWidth(pos), '0')
}

const EMPTY_FORM = {
  tipo_ncf: '',
  ncf: '',
  rnc: '',
  impuesto: '',
  itbis_retenido: '',
  isr_retenido: '',
  tipo_gasto: '',
  tipo_retencion: '',
  forma_pago: '',
}

export function CxpCorregirNcf({ noCia, punto = '' }: P) {
  const qc = useQueryClient()
  const [proveedor, setProveedor] = useState<any | null>(null)
  const [fpInput, setFpInput] = useState('')
  const [fpBusqueda, setFpBusqueda] = useState('')
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  // NO_DOCU en TCXP_DOCUMENTO es CHAR(7): "8347" → "0008347"
  const buscarFp = () => {
    const n = fpInput.replace(/[^0-9]/g, '')
    setFpBusqueda(n ? n.padStart(7, '0') : '')
  }

  const docsQ = useQuery({
    queryKey: ['cxp-corregir-ncf', noCia, punto, proveedor?.no_proveedor ?? '', fpBusqueda],
    queryFn: () =>
      api.cxpCorregirNcfDocs({
        no_cia: noCia,
        punto,
        ...(fpBusqueda
          ? { tipo_docu: 'FP', no_docu: fpBusqueda }
          : { no_proveedor: proveedor.no_proveedor }),
      }),
    enabled: !!noCia && !!punto && (!!fpBusqueda || !!proveedor?.no_proveedor),
  })

  const gastosQ = useQuery({ queryKey: ['cxp-tipos-gasto'], queryFn: () => api.cxpListTiposGasto() })
  const retQ = useQuery({ queryKey: ['cxp-tipos-retencion'], queryFn: () => api.cxpListTiposRetencion() })
  const fpQ = useQuery({ queryKey: ['cxp-formas-pago'], queryFn: () => api.cxpListFormasPago() })

  const openEdit = (doc: any) => {
    setForm({
      tipo_ncf: (doc.posiciones_fijas_ncf || '').toString().trim().toUpperCase(),
      ncf: doc.ncf != null && doc.ncf !== ''
        ? String(doc.ncf).padStart(
            ncfWidth((doc.posiciones_fijas_ncf || '').toString().trim().toUpperCase()),
            '0')
        : '',
      rnc: doc.rnc || '',
      impuesto: doc.impuesto ? String(doc.impuesto) : '',
      itbis_retenido: doc.itbis_retenido ? String(doc.itbis_retenido) : '',
      isr_retenido: doc.isr_retenido ? String(doc.isr_retenido) : '',
      tipo_gasto: doc.tipo_gasto ? String(doc.tipo_gasto) : '',
      tipo_retencion: doc.tipo_retencion ? String(doc.tipo_retencion) : '',
      forma_pago: doc.forma_pago ? String(doc.forma_pago) : '',
    })
    setEditing(doc)
  }

  const save = useMutation({
    mutationFn: () =>
      api.cxpCorregirNcf({
        no_cia: noCia,
        punto,
        tipo_docu: editing.tipo_docu,
        no_docu: editing.no_docu,
        ncf: form.ncf,
        posiciones_fijas_ncf: form.tipo_ncf,
        rnc: form.rnc,
        impuesto: form.impuesto ? Number(form.impuesto) : 0,
        itbis_retenido: form.itbis_retenido ? Number(form.itbis_retenido) : 0,
        isr_retenido: form.isr_retenido ? Number(form.isr_retenido) : 0,
        tipo_gasto: form.tipo_gasto || null,
        tipo_retencion: form.tipo_retencion ? Number(form.tipo_retencion) : null,
        forma_pago: form.forma_pago ? Number(form.forma_pago) : null,
      }),
    onSuccess: () => {
      toast.success(
        `NCF del documento ${editing.tipo_docu}-${editing.no_docu} corregido` +
          (form.tipo_ncf && form.ncf
            ? ` (${form.tipo_ncf}${form.ncf.padStart(ncfWidth(form.tipo_ncf), '0')})`
            : '')
      )
      qc.invalidateQueries({ queryKey: ['cxp-corregir-ncf'] })
      setEditing(null)
    },
    onError: (e: any) =>
      toast.error(e?.detail?.error || e?.message || 'No se pudo corregir el documento'),
  })

  const rows = docsQ.data || []

  return (
    <div className='space-y-4 p-6'>
      <div>
        <h1 className='text-2xl font-semibold'>Corregir NCF</h1>
        <p className='text-sm text-muted-foreground'>
          Corrige el NCF, RNC, ITBIS y clasificaciones DGII de un documento ya
          registrado, sin alterar valores ni saldos. Equivale a la forma legacy{' '}
          <i>Fcxp212</i> sobre <span className='font-mono'>TCXP_DOCUMENTO</span>.
        </p>
      </div>

      <div className='grid grid-cols-1 gap-3 md:grid-cols-2 md:max-w-3xl'>
        <ProveedorPicker value={proveedor} onChange={setProveedor} />
        <div className='min-w-0 space-y-1'>
          <Label className='text-xs'>Buscar por No. FP</Label>
          <div className='flex gap-2'>
            <Input
              value={fpInput}
              onChange={(e) => setFpInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 7))}
              onKeyDown={(e) => e.key === 'Enter' && buscarFp()}
              className='h-10 font-mono'
              inputMode='numeric'
              maxLength={7}
              placeholder='ej. 8347'
            />
            <Button variant='outline' className='h-10' onClick={buscarFp} disabled={!fpInput}>
              <Search className='mr-1 h-4 w-4' /> Buscar
            </Button>
            {fpBusqueda && (
              <Button
                variant='ghost'
                size='icon'
                className='h-10 w-10'
                onClick={() => {
                  setFpBusqueda('')
                  setFpInput('')
                }}
                title='Limpiar búsqueda por FP'
              >
                <X className='h-4 w-4' />
              </Button>
            )}
          </div>
          {fpBusqueda && (
            <p className='font-mono text-xs text-muted-foreground'>
              Mostrando documento FP-{fpBusqueda}
            </p>
          )}
        </div>
      </div>

      {!proveedor?.no_proveedor && !fpBusqueda ? (
        <div className='rounded border py-10 text-center text-sm text-muted-foreground'>
          Busca un proveedor con la lupa, o escribe el número de la factura (FP)
          y pulsa Buscar, para ver los documentos y corregir el NCF.
        </div>
      ) : docsQ.isLoading ? (
        <Skeleton className='h-40 w-full' />
      ) : (
        <div className='overflow-x-auto rounded border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>NCF DGI</TableHead>
                <TableHead>RNC</TableHead>
                <TableHead className='text-right'>Valor</TableHead>
                <TableHead className='text-right'>ITBIS</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className='text-right'>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d: any) => (
                <TableRow key={`${d.tipo_docu}-${d.no_docu}`}>
                  <TableCell className='font-mono'>
                    {d.tipo_docu}-{d.no_docu}
                  </TableCell>
                  <TableCell>{d.fecha}</TableCell>
                  <TableCell className='font-mono'>
                    {ncfDgi(d) || <span className='text-muted-foreground'>—</span>}
                  </TableCell>
                  <TableCell className='font-mono'>{d.rnc || ''}</TableCell>
                  <TableCell className='text-right font-mono tabular-nums'>
                    RD$ {fmt(d.valor_original)}
                  </TableCell>
                  <TableCell className='text-right font-mono tabular-nums'>
                    {Number(d.impuesto) > 0 ? fmt(d.impuesto) : ''}
                  </TableCell>
                  <TableCell>
                    {d.status === 'R' ? (
                      <Badge variant='destructive'>Reversado</Badge>
                    ) : d.status === 'C' ? (
                      <Badge variant='outline'>Cerrado</Badge>
                    ) : (
                      <Badge>Activo</Badge>
                    )}
                  </TableCell>
                  <TableCell className='text-right'>
                    <Button size='sm' variant='outline' onClick={() => openEdit(d)}>
                      <Pencil className='mr-1 h-3.5 w-3.5' /> Corregir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className='py-6 text-center text-muted-foreground'>
                    {fpBusqueda
                      ? `No existe el documento FP-${fpBusqueda} en este punto.`
                      : `El proveedor ${proveedor?.nombre || proveedor?.no_proveedor} no tiene documentos registrados en este punto.`}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && !save.isPending && setEditing(null)}>
        <DialogContent className='h-auto max-h-[85vh] max-w-lg overflow-y-auto sm:max-h-[85vh]'>
          <DialogHeader>
            <DialogTitle>
              Corregir {editing?.tipo_docu}-{editing?.no_docu}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className='space-y-3'>
              <div className='rounded border bg-muted/40 px-3 py-2 text-sm'>
                <b>{editing.proveedor || proveedor?.nombre}</b> · {editing.fecha} ·
                Valor RD$ {fmt(editing.valor_original)}
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div className='min-w-0 space-y-1'>
                  <Label className='text-xs'>Tipo NCF</Label>
                  <Select
                    value={form.tipo_ncf}
                    onValueChange={(v) => setForm((f) => ({ ...f, tipo_ncf: v }))}
                  >
                    <SelectTrigger className='h-10 w-full font-mono'>
                      <SelectValue placeholder='B0X' />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_NCF.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='min-w-0 space-y-1'>
                  <Label className='text-xs'>NCF (número)</Label>
                  <Input
                    value={form.ncf}
                    onChange={(e) => {
                      const w = ncfWidth(form.tipo_ncf)
                      const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, w)
                      setForm((f) => ({ ...f, ncf: raw }))
                    }}
                    onBlur={() => {
                      const n = (form.ncf || '').replace(/[^0-9]/g, '')
                      if (n) setForm((f) => ({ ...f, ncf: n.padStart(ncfWidth(form.tipo_ncf), '0') }))
                    }}
                    className='h-10 font-mono'
                    inputMode='numeric'
                    maxLength={ncfWidth(form.tipo_ncf)}
                    placeholder={ncfWidth(form.tipo_ncf) === 10 ? 'ej. 0000000281' : 'ej. 00000281'}
                  />
                </div>
              </div>
              {form.tipo_ncf && form.ncf && (
                <div className='font-mono text-xs text-muted-foreground'>
                  NCF DGI resultante: {form.tipo_ncf}{form.ncf.padStart(ncfWidth(form.tipo_ncf), '0')}
                </div>
              )}
              <div className='grid grid-cols-2 gap-3'>
                <div className='min-w-0 space-y-1'>
                  <Label className='text-xs'>RNC</Label>
                  <Input
                    value={form.rnc}
                    onChange={(e) => setForm((f) => ({ ...f, rnc: e.target.value }))}
                    className='h-10 font-mono'
                  />
                </div>
                <div className='min-w-0 space-y-1'>
                  <Label className='text-xs'>ITBIS Facturado</Label>
                  <Input
                    type='number'
                    step='0.01'
                    value={form.impuesto}
                    onChange={(e) => setForm((f) => ({ ...f, impuesto: e.target.value }))}
                    className='h-10 text-right font-mono'
                  />
                </div>
                <div className='min-w-0 space-y-1'>
                  <Label className='text-xs'>ITBIS Retenido</Label>
                  <Input
                    type='number'
                    step='0.01'
                    value={form.itbis_retenido}
                    onChange={(e) => setForm((f) => ({ ...f, itbis_retenido: e.target.value }))}
                    className='h-10 text-right font-mono'
                  />
                </div>
                <div className='min-w-0 space-y-1'>
                  <Label className='text-xs'>ISR Retenido</Label>
                  <Input
                    type='number'
                    step='0.01'
                    value={form.isr_retenido}
                    onChange={(e) => setForm((f) => ({ ...f, isr_retenido: e.target.value }))}
                    className='h-10 text-right font-mono'
                  />
                </div>
              </div>
              <div className='grid grid-cols-1 gap-3'>
                <div className='min-w-0 space-y-1'>
                  <Label className='text-xs'>Tipo de Gasto (DGI)</Label>
                  <Select
                    value={form.tipo_gasto}
                    onValueChange={(v) => setForm((f) => ({ ...f, tipo_gasto: v === '__none__' ? '' : v }))}
                  >
                    <SelectTrigger className='h-10 w-full'>
                      <SelectValue placeholder='Sin clasificar' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='__none__'>— Sin clasificar —</SelectItem>
                      {(gastosQ.data || []).map((t: any) => (
                        <SelectItem key={t.tipo_gasto} value={String(t.tipo_gasto)}>
                          {t.tipo_gasto} — {t.descripcion}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='min-w-0 space-y-1'>
                  <Label className='text-xs'>Tipo de Retención</Label>
                  <Select
                    value={form.tipo_retencion}
                    onValueChange={(v) => setForm((f) => ({ ...f, tipo_retencion: v === '__none__' ? '' : v }))}
                  >
                    <SelectTrigger className='h-10 w-full'>
                      <SelectValue placeholder='Ninguna' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='__none__'>— Ninguna —</SelectItem>
                      {(retQ.data || []).map((t: any) => (
                        <SelectItem key={t.tipo_retencion} value={String(t.tipo_retencion)}>
                          {t.tipo_retencion} — {t.descripcion}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='min-w-0 space-y-1'>
                  <Label className='text-xs'>Forma de Pago</Label>
                  <Select
                    value={form.forma_pago}
                    onValueChange={(v) => setForm((f) => ({ ...f, forma_pago: v === '__none__' ? '' : v }))}
                  >
                    <SelectTrigger className='h-10 w-full'>
                      <SelectValue placeholder='No especificada' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='__none__'>— No especificada —</SelectItem>
                      {(fpQ.data || []).map((f2: any) => (
                        <SelectItem key={f2.forma_pago} value={String(f2.forma_pago)}>
                          {f2.forma_pago} — {f2.descripcion}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className='flex justify-end gap-2 pt-2'>
                <Button variant='outline' onClick={() => setEditing(null)} disabled={save.isPending}>
                  Cancelar
                </Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  <Save className='mr-2 h-4 w-4' />
                  {save.isPending ? 'Guardando…' : 'Guardar Corrección'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
