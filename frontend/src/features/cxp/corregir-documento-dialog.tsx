// CxP — dialogo compartido para corregir NCF/datos DGII de un documento
// (equivale a Fcxp212). Usado tanto por la pantalla "Corregir NCF" como por
// el boton "Editar" en "Consulta / Impresion de Documentos". Bloquea editar
// documentos de un periodo contable YA CERRADO -- el backend
// (corregir_datos_dgii / entrada_documento) tambien lo exige, esto es solo
// para no dejar intentar en la UI.
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { regalGeneralApi as api } from '@/lib/regal-general-api'
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

const TIPOS_NCF = ['B01', 'B02', 'B03', 'B04', 'B11', 'B13', 'B14', 'B15', 'E31', 'E32', 'E34']

const ncfWidth = (pos: string): number => (pos.startsWith('E') ? 10 : 8)

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

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

export interface CxpDocumentoParaCorregir {
  no_cia?: string
  punto?: string
  tipo_docu: string
  no_docu: string
  proveedor?: string
  nombre_proveedor?: string
  fecha: string
  valor_original: number
  ncf?: number | string | null
  posiciones_fijas_ncf?: string | null
  rnc?: string | null
  impuesto?: number | null
  itbis_retenido?: number | null
  isr_retenido?: number | null
  tipo_gasto?: string | null
  tipo_retencion?: number | null
  forma_pago?: number | null
}

// Periodo contable real en curso (TCXP_PUNTO.ano_proceso/mes_proceso), NO el
// mes calendario: el punto solo avanza cuando se ejecuta el cierre mensual,
// asi que puede quedarse "atras" del mes real varios dias/semanas sin que el
// periodo este cerrado.
export function usePeriodoActualCxP(noCia: string, punto: string) {
  const q = useQuery({
    queryKey: ['cxp-punto', noCia, punto],
    queryFn: async () => {
      const all = await api.cxpListPuntos(noCia)
      return (all as any[]).find((p) => String(p.punto) === String(punto)) || null
    },
    enabled: !!noCia && !!punto,
  })
  const periodo = q.data
    ? `${q.data.ano_proceso}-${String(q.data.mes_proceso).padStart(2, '0')}`
    : null
  return { periodo, isLoading: q.isLoading }
}

// Un documento es editable si NO pertenece a un periodo YA CERRADO (anterior
// al periodo de proceso). Antes se comparaba la fecha del documento contra
// el mes calendario actual, lo que bloqueaba documentos del periodo en curso
// mientras el punto no habia avanzado su mes_proceso (cierre pendiente de
// ejecutar) aunque nada estuviera realmente cerrado.
export function esDocumentoEditable(fecha: string, periodoActual: string | null | undefined): boolean {
  if (!fecha || !periodoActual) return false
  return fecha.slice(0, 7) >= periodoActual
}

interface Props {
  doc: CxpDocumentoParaCorregir | null
  noCia: string
  punto?: string
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

export function CxpCorregirDocumentoDialog({ doc, noCia, punto = '', onOpenChange, onSaved }: Props) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ ...EMPTY_FORM })

  const gastosQ = useQuery({ queryKey: ['cxp-tipos-gasto'], queryFn: () => api.cxpListTiposGasto() })
  const retQ = useQuery({ queryKey: ['cxp-tipos-retencion'], queryFn: () => api.cxpListTiposRetencion() })
  const fpQ = useQuery({ queryKey: ['cxp-formas-pago'], queryFn: () => api.cxpListFormasPago() })

  useEffect(() => {
    if (!doc) return
    const posActual = (doc.posiciones_fijas_ncf || '').toString().trim().toUpperCase()
    setForm({
      tipo_ncf: posActual,
      ncf: doc.ncf != null && doc.ncf !== '' ? String(doc.ncf).padStart(ncfWidth(posActual), '0') : '',
      rnc: doc.rnc || '',
      impuesto: doc.impuesto ? String(doc.impuesto) : '',
      itbis_retenido: doc.itbis_retenido ? String(doc.itbis_retenido) : '',
      isr_retenido: doc.isr_retenido ? String(doc.isr_retenido) : '',
      tipo_gasto: doc.tipo_gasto ? String(doc.tipo_gasto) : '',
      tipo_retencion: doc.tipo_retencion ? String(doc.tipo_retencion) : '',
      forma_pago: doc.forma_pago ? String(doc.forma_pago) : '',
    })
  }, [doc])

  const save = useMutation({
    mutationFn: () =>
      api.cxpCorregirNcf({
        no_cia: doc?.no_cia || noCia,
        punto: doc?.punto || punto,
        tipo_docu: doc?.tipo_docu,
        no_docu: doc?.no_docu,
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
        `${doc?.tipo_docu}-${doc?.no_docu} corregido` +
          (form.tipo_ncf && form.ncf
            ? ` (${form.tipo_ncf}${form.ncf.padStart(ncfWidth(form.tipo_ncf), '0')})`
            : '')
      )
      qc.invalidateQueries({ queryKey: ['cxp-corregir-ncf'] })
      qc.invalidateQueries({ queryKey: ['cxp-documentos'] })
      qc.invalidateQueries({ queryKey: ['cxp-documento'] })
      onOpenChange(false)
      onSaved?.()
    },
    onError: (e: any) =>
      toast.error(e?.detail?.error || e?.message || 'No se pudo corregir el documento'),
  })

  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && !save.isPending && onOpenChange(false)}>
      <DialogContent className='h-auto max-h-[85vh] max-w-lg overflow-y-auto sm:max-h-[85vh]'>
        <DialogHeader>
          <DialogTitle>
            Corregir {doc?.tipo_docu}-{doc?.no_docu}
          </DialogTitle>
        </DialogHeader>
        {doc && (
          <div className='space-y-3'>
            <div className='rounded border bg-muted/40 px-3 py-2 text-sm'>
              <b>{doc.nombre_proveedor || doc.proveedor}</b> · {doc.fecha} ·
              Valor RD$ {fmt(doc.valor_original)}
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
              <Button variant='outline' onClick={() => onOpenChange(false)} disabled={save.isPending}>
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
  )
}
