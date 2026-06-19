// ACF — Retiro de Activo Fijo (Facf202).
// UPDATE TACF_ACTIVOS.status='R' + fecha_retiro + INSERT TACF_DOCUMENTO tipo_movi='R'.
import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Search, Archive, AlertTriangle } from 'lucide-react'

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (s: any) => s ? String(s).slice(0, 10) : ''

type Activo = {
  no_cia: string; punto: string; no_activo: string
  descripcion: string; grupo: string; departamento: string
  valor_original: number; depre_acumu: number; status: string
  fecha_compra: any
}

function ActivoPicker({
  value, onChange,
}: { value: Activo | null; onChange: (a: Activo | null) => void }) {
  const { selectedCompany, selectedPoint } = useCompany()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const q = useQuery({
    queryKey: ['acf-act-pick', selectedCompany, selectedPoint, search],
    queryFn: () => api.acfListActivos({
      no_cia: selectedCompany, punto: selectedPoint,
      status: 'A', search: search || undefined, limit: 200,
    }),
    enabled: open,
  })
  return (
    <div className="space-y-1">
      <Label className="text-xs">Activo a retirar *</Label>
      <div className="flex items-center gap-2">
        <Input value={value?.no_activo ?? ''} readOnly placeholder="—"
               className="h-9 w-32 font-mono" />
        <Button type="button" variant="outline" size="sm" className="h-9"
                onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}>
          <Search className="h-4 w-4" />
        </Button>
        {value ? (
          <div className="flex flex-1 flex-wrap items-center gap-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm">
            <div className="min-w-0">
              <div className="text-[10px] uppercase text-amber-700">Descripción</div>
              <div className="truncate font-medium text-amber-900">{value.descripcion}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-amber-700">Grupo / Depto</div>
              <div className="text-amber-800">{value.grupo} · {value.departamento}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-amber-700">Valor original</div>
              <div className="text-amber-800 tabular-nums">RD$ {fmt(value.valor_original)}</div>
            </div>
            <Button type="button" size="sm" variant="ghost"
                    className="ml-auto text-muted-foreground hover:text-destructive"
                    onClick={() => onChange(null)}>Cambiar</Button>
          </div>
        ) : (
          <div className="flex h-9 flex-1 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">
            Usa la lupa para elegir un activo en estado A.
          </div>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[70vh] w-[60vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="shrink-0 border-b px-6 py-4"><DialogTitle>Buscar activo</DialogTitle></DialogHeader>
          <div className="shrink-0 border-b bg-background px-6 py-3">
            <Input ref={inputRef} value={search} onChange={(e) => setSearch(e.target.value)}
                   placeholder="Descripción, código o serie…" className="h-11 text-base" autoFocus />
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background"><TableRow>
                <TableHead className="w-24">No. Activo</TableHead><TableHead>Descripción</TableHead>
                <TableHead className="w-20">Grupo</TableHead><TableHead className="w-24">Depto</TableHead>
                <TableHead className="w-28 text-right">V. original</TableHead>
                <TableHead className="w-24 text-center">Acción</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(q.data || []).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    {q.isFetching ? 'Buscando…' : 'Sin resultados'}
                  </TableCell></TableRow>
                ) : (q.data || []).map((a: any) => (
                  <TableRow key={`${a.punto}-${a.no_activo}`} className="cursor-pointer hover:bg-muted/40"
                            onClick={() => { onChange(a); setOpen(false); setSearch('') }}>
                    <TableCell className="font-mono text-xs">{a.no_activo}</TableCell>
                    <TableCell className="truncate max-w-md">{a.descripcion}</TableCell>
                    <TableCell>{a.grupo}</TableCell>
                    <TableCell>{a.departamento}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(a.valor_original)}</TableCell>
                    <TableCell className="text-center"><Button size="sm" variant="outline">Elegir</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function AcfRetiro() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()

  const [activo, setActivo] = useState<Activo | null>(null)
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [motivo, setMotivo] = useState('')
  const [cuenta, setCuenta] = useState('')

  const valorLibros = activo
    ? Number(activo.valor_original || 0) - Number(activo.depre_acumu || 0)
    : 0

  const reset = () => {
    setActivo(null); setFecha(new Date().toISOString().slice(0, 10))
    setMotivo(''); setCuenta('')
  }

  const ejecutar = useMutation({
    mutationFn: () => api.acfCrearRetiro({
      no_cia: selectedCompany, punto: selectedPoint,
      no_activo: activo!.no_activo, fecha_retiro: fecha,
      motivo: motivo.trim(), cuenta: cuenta.trim(),
    }),
    onSuccess: (res) => {
      toast.success(
        `Activo ${res.no_activo} retirado. Valor en libros RD$ ${fmt(res.valor_libros)}`)
      qc.invalidateQueries({ queryKey: ['acf-act'] })
      qc.invalidateQueries({ queryKey: ['acf-res'] })
      reset()
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo retirar el activo'),
  })

  const puedeGuardar = !!activo && !!fecha && !!motivo && !!cuenta

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Retiro de Activo Fijo</h3>
        <p className="text-sm text-muted-foreground">
          Da de baja un activo (venta, donación, obsolescencia). Equivale a{' '}
          <i>Facf202 — Retiros</i>. Marca <code>status='R'</code> y registra
          documento en <code>TACF_DOCUMENTO</code>.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">
          <Archive className="h-4 w-4" /> Datos del retiro
        </CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <ActivoPicker value={activo} onChange={setActivo} />

          {activo && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded border bg-muted/40 px-3 py-2">
                <div className="text-[10px] uppercase text-muted-foreground">Valor original</div>
                <div className="text-base font-semibold tabular-nums">RD$ {fmt(activo.valor_original)}</div>
              </div>
              <div className="rounded border bg-muted/40 px-3 py-2">
                <div className="text-[10px] uppercase text-muted-foreground">Depreciación acum.</div>
                <div className="text-base font-semibold tabular-nums">RD$ {fmt(activo.depre_acumu)}</div>
              </div>
              <div className="rounded border bg-emerald-50 border-emerald-200 px-3 py-2">
                <div className="text-[10px] uppercase text-emerald-700">Valor en libros</div>
                <div className="text-base font-semibold tabular-nums text-emerald-900">RD$ {fmt(valorLibros)}</div>
              </div>
              <div className="rounded border bg-muted/40 px-3 py-2">
                <div className="text-[10px] uppercase text-muted-foreground">F. compra</div>
                <div className="text-sm font-medium">{fmtDate(activo.fecha_compra)}</div>
                <Badge className="mt-1">Estado: A</Badge>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Fecha de retiro *</Label>
              <Input type="date" className="h-9" value={fecha}
                     onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cuenta contable de salida *</Label>
              <Input value={cuenta} onChange={(e) => setCuenta(e.target.value)}
                     placeholder="Ej. 5.1.04.0001" className="h-9 font-mono" maxLength={24} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Motivo / Justificación *</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)}
                   placeholder="Ej. Venta a empleado / Equipo dañado fuera de uso" className="h-9" maxLength={100} />
          </div>

          {activo && (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex gap-2 items-start">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                Al confirmar, el activo <b>{activo.no_activo}</b> pasará a estado <b>Retirado</b>{' '}
                y dejará de aparecer en los reportes de depreciación. Esta acción no se reversa
                desde la UI.
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t pt-3">
            <Button type="button" variant="outline" onClick={reset} disabled={ejecutar.isPending}>
              Limpiar
            </Button>
            <Button type="button" variant="destructive" onClick={() => ejecutar.mutate()}
                    disabled={!puedeGuardar || ejecutar.isPending}>
              <Archive className="h-4 w-4 mr-1" />
              {ejecutar.isPending ? 'Retirando…' : 'Confirmar retiro'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
