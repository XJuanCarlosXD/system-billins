// CxP Solicitudes de Pago — puente CxP → CHC.
//
// CxpGenerarSolicitud  ≙ Fcxp209 "Generar Solicitud a Cheque":
//   selecciona documentos con saldo del proveedor y crea un SO en CHC
//   (TCHC_CHEQUE tipo_transaccion='K' + TCHC_REFEDOCU).
// CxpSolicitudesPago   ≙ Fcxp207 "Procesar Solicitud de Pago":
//   consulta las solicitudes SO con sus documentos referenciados.
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Search, Send } from 'lucide-react'
import { toast } from 'sonner'
import { regalGeneralApi as api } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
const fmtDate = (s: any) => (s ? String(s).slice(0, 10) : '')
const today = new Date().toISOString().slice(0, 10)

// ─── Fcxp209 — Generar Solicitud a Cheque ────────────────────────────────────
export function CxpGenerarSolicitud({ noCia, punto = '' }: P) {
  const qc = useQueryClient()
  const [proveedor, setProveedor] = useState<any | null>(null)
  const [cuentaBanco, setCuentaBanco] = useState('')
  const [fechaCheque, setFechaCheque] = useState(today)
  const [detalle, setDetalle] = useState('')
  const [montos, setMontos] = useState<Record<string, number>>({})

  const cuentasQ = useQuery({
    queryKey: ['chc-cuentas', noCia, punto],
    queryFn: () => api.chcListCuentas({ no_cia: noCia, punto, activa: 'S' }),
    enabled: !!noCia && !!punto,
  })

  const docsQ = useQuery({
    queryKey: ['cxp-solicitud-docs', noCia, punto, proveedor?.no_proveedor],
    queryFn: () =>
      api.cxpSolicitudChequeDocs(noCia, punto, proveedor!.no_proveedor),
    enabled: !!noCia && !!punto && !!proveedor?.no_proveedor,
  })
  const docs = docsQ.data ?? []

  const keyOf = (d: any) => `${d.tipo_docu}:${d.no_docu}`
  const disponible = (d: any) =>
    Math.max(0, Number(d.saldo || 0) - Number(d.monto_solicitado || 0))
  const total = useMemo(
    () => Object.values(montos).reduce((s, v) => s + (v || 0), 0),
    [montos]
  )

  const generar = useMutation({
    mutationFn: () =>
      api.cxpGenerarSolicitudCheque({
        no_cia: noCia,
        punto,
        cuenta_banco: cuentaBanco,
        no_proveedor: proveedor!.no_proveedor,
        fecha_cheque: fechaCheque || undefined,
        detalle: detalle || undefined,
        docs: Object.entries(montos)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => {
            const [tipo_docu, no_docu] = k.split(':')
            return { tipo_docu, no_docu, monto: v }
          }),
      }),
    onSuccess: (r) => {
      toast.success(
        `Solicitud SO-${r.no_docu} generada por RD$ ${fmt(r.total)} (${r.documentos} documento${r.documentos === 1 ? '' : 's'})`
      )
      setMontos({})
      setDetalle('')
      qc.invalidateQueries({ queryKey: ['cxp-solicitud-docs'] })
      qc.invalidateQueries({ queryKey: ['cxp-solicitudes-pago'] })
    },
    onError: (e: any) =>
      toast.error(
        e?.detail?.error || e?.message || 'No se pudo generar la solicitud'
      ),
  })

  const puedeGenerar =
    !!proveedor && !!cuentaBanco && total > 0 && !generar.isPending

  const submit = () => {
    if (!puedeGenerar) return
    if (
      !confirm(
        `¿Generar solicitud de cheque por RD$ ${fmt(total)} a favor de ${proveedor.nombre}?`
      )
    )
      return
    generar.mutate()
  }

  return (
    <div className='space-y-4'>
      <div>
        <h3 className='text-base font-semibold'>
          Generar Solicitud a Cheque
        </h3>
        <p className='text-sm text-muted-foreground'>
          Equivale a <i>Fcxp209</i>. Selecciona los documentos por pagar del
          proveedor y genera una Solicitud de Cheque (SO) en el módulo de
          Cheques para su emisión.
        </p>
      </div>

      <Card>
        <CardContent className='grid grid-cols-1 items-end gap-3 pt-6 md:grid-cols-6'>
          <ProveedorPicker value={proveedor} onChange={setProveedor} />
          <div className='space-y-1'>
            <Label className='text-xs'>
              Cuenta de banco <span className='text-destructive'>*</span>
            </Label>
            <Select value={cuentaBanco} onValueChange={setCuentaBanco}>
              <SelectTrigger className='h-10'>
                <SelectValue placeholder='Seleccione' />
              </SelectTrigger>
              <SelectContent>
                {(cuentasQ.data ?? []).map((c: any) => (
                  <SelectItem key={c.cuenta_banco} value={String(c.cuenta_banco)}>
                    {c.cuenta_banco}
                    {c.nombre ? ` — ${c.nombre}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1'>
            <Label className='text-xs'>Fecha cheque</Label>
            <Input
              type='date'
              className='h-10'
              value={fechaCheque}
              onChange={(e) => setFechaCheque(e.target.value)}
            />
          </div>
          <div className='space-y-1'>
            <Label className='text-xs'>Detalle</Label>
            <Input
              className='h-10'
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              placeholder='Concepto de la solicitud'
              maxLength={100}
            />
          </div>
        </CardContent>
      </Card>

      {proveedor &&
        (docsQ.isLoading ? (
          <Skeleton className='h-40 w-full' />
        ) : (
          <Card>
            <CardContent className='space-y-3 pt-6'>
              <h3 className='font-semibold'>Documentos con saldo</h3>
              <div className='overflow-x-auto rounded border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Detalle</TableHead>
                      <TableHead className='text-right'>Saldo</TableHead>
                      <TableHead className='text-right'>
                        En solicitudes
                      </TableHead>
                      <TableHead className='text-right'>Disponible</TableHead>
                      <TableHead className='w-40 text-right'>
                        Monto a pagar
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs.map((d: any) => {
                      const k = keyOf(d)
                      const disp = disponible(d)
                      const bloqueado = d.pago_bloqueado === 'S'
                      return (
                        <TableRow key={k} className={bloqueado ? 'opacity-60' : ''}>
                          <TableCell className='font-mono text-sm'>
                            {d.tipo_docu}-{d.no_docu}
                            {bloqueado && (
                              <Badge variant='destructive' className='ml-2'>
                                Bloqueado
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className='text-sm'>
                            {fmtDate(d.fecha)}
                          </TableCell>
                          <TableCell className='max-w-56 truncate text-sm'>
                            {d.detalle}
                          </TableCell>
                          <TableCell className='text-right tabular-nums'>
                            {fmt(d.saldo)}
                          </TableCell>
                          <TableCell className='text-right tabular-nums text-muted-foreground'>
                            {fmt(d.monto_solicitado)}
                          </TableCell>
                          <TableCell className='text-right tabular-nums'>
                            {fmt(disp)}
                          </TableCell>
                          <TableCell className='text-right'>
                            <Input
                              type='number'
                              min={0}
                              max={disp}
                              step='0.01'
                              disabled={bloqueado || disp <= 0}
                              className='h-8 w-36 text-right tabular-nums'
                              value={montos[k] ?? ''}
                              onChange={(e) => {
                                const v = e.target.value
                                  ? Math.min(Number(e.target.value), disp)
                                  : 0
                                setMontos((m) => ({ ...m, [k]: v }))
                              }}
                              placeholder='0.00'
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {docs.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className='py-6 text-center text-muted-foreground'
                        >
                          El proveedor {proveedor.nombre} no tiene documentos
                          con saldo por pagar.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className='flex items-center justify-end gap-4'>
                <div className='text-sm'>
                  Total solicitud:{' '}
                  <span className='font-semibold tabular-nums'>
                    RD$ {fmt(total)}
                  </span>
                </div>
                <Button onClick={submit} disabled={!puedeGenerar}>
                  <Send className='mr-2 h-4 w-4' />
                  {generar.isPending ? 'Generando…' : 'Generar solicitud'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
    </div>
  )
}

// ─── Fcxp207 — Solicitudes de Pago (consulta / seguimiento) ──────────────────
export function CxpSolicitudesPago({ noCia, punto = '' }: P) {
  const [noProv, setNoProv] = useState('')
  const [pendientes, setPendientes] = useState('S')
  const [expanded, setExpanded] = useState<string | null>(null)

  const q = useQuery({
    queryKey: ['cxp-solicitudes-pago', noCia, punto, noProv, pendientes],
    queryFn: () =>
      api.cxpListSolicitudesPago({
        no_cia: noCia,
        punto,
        no_proveedor: noProv || undefined,
        pendientes,
      }),
    enabled: !!noCia && !!punto,
  })
  const rows = q.data ?? []

  const refsQ = useQuery({
    queryKey: ['cxp-solicitud-refs', noCia, punto, expanded],
    queryFn: () => api.cxpSolicitudReferencias(expanded!, noCia, punto),
    enabled: !!expanded,
  })

  const estadoBadge = (r: any) => {
    if (r.st_nulo !== 'A') return <Badge variant='destructive'>Anulada</Badge>
    if (r.st_impresion === 'S') return <Badge variant='outline'>Procesada</Badge>
    if (r.autorizado === 'S') return <Badge>Autorizada</Badge>
    return <Badge variant='secondary'>Pendiente</Badge>
  }

  return (
    <div className='space-y-4'>
      <div>
        <h3 className='text-base font-semibold'>Solicitudes de Pago</h3>
        <p className='text-sm text-muted-foreground'>
          Equivale a <i>Fcxp207</i>. Seguimiento de las Solicitudes de Cheque
          (SO) generadas desde Cuentas por Pagar; la emisión e impresión del
          cheque se realiza en el módulo de Cheques.
        </p>
      </div>

      <div className='flex flex-wrap items-end gap-3'>
        <div className='space-y-1'>
          <Label className='text-xs'>No. Proveedor</Label>
          <Input
            className='h-9 w-40 font-mono'
            value={noProv}
            onChange={(e) => setNoProv(e.target.value)}
            placeholder='Todos'
          />
        </div>
        <div className='space-y-1'>
          <Label className='text-xs'>Estado</Label>
          <Select value={pendientes} onValueChange={setPendientes}>
            <SelectTrigger className='h-9 w-44'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='S'>Solo pendientes</SelectItem>
              <SelectItem value='N'>Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size='sm' variant='outline' onClick={() => q.refetch()}>
          <Search className='mr-1 h-4 w-4' /> Buscar
        </Button>
        <div className='ml-auto text-sm text-muted-foreground'>
          {rows.length} solicitud{rows.length === 1 ? '' : 'es'}
        </div>
      </div>

      {q.isLoading ? (
        <Skeleton className='h-40 w-full' />
      ) : (
        <div className='overflow-x-auto rounded border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Solicitud</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Beneficiario</TableHead>
                <TableHead>Cuenta banco</TableHead>
                <TableHead className='text-right'>Valor</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className='text-right'>Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={`${r.tipo_docu}-${r.no_docu}`}>
                  <TableCell className='font-mono text-sm'>
                    {r.tipo_docu}-{r.no_docu}
                  </TableCell>
                  <TableCell className='text-sm'>
                    {fmtDate(r.fecha_solicitud)}
                  </TableCell>
                  <TableCell className='text-sm'>{r.beneficiario}</TableCell>
                  <TableCell className='font-mono text-sm'>
                    {r.cuenta_banco}
                  </TableCell>
                  <TableCell className='text-right tabular-nums'>
                    RD$ {fmt(r.valor_original)}
                  </TableCell>
                  <TableCell>{estadoBadge(r)}</TableCell>
                  <TableCell className='text-right'>
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() =>
                        setExpanded(expanded === r.no_docu ? null : r.no_docu)
                      }
                    >
                      <FileText className='mr-1 h-4 w-4' />
                      {expanded === r.no_docu ? 'Ocultar' : 'Ver docs'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className='py-6 text-center text-muted-foreground'
                  >
                    No hay solicitudes{' '}
                    {pendientes === 'S' ? 'pendientes ' : ''}para los filtros
                    seleccionados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {expanded && (
        <Card>
          <CardContent className='space-y-2 pt-6'>
            <h3 className='font-semibold'>
              Documentos de la solicitud SO-{expanded}
            </h3>
            {refsQ.isLoading ? (
              <Skeleton className='h-24 w-full' />
            ) : (
              <div className='overflow-x-auto rounded border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Documento CxP</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Detalle</TableHead>
                      <TableHead className='text-right'>Monto aplicado</TableHead>
                      <TableHead className='text-right'>Saldo actual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(refsQ.data ?? []).map((d: any) => (
                      <TableRow key={`${d.tipo_refe}-${d.no_refe}`}>
                        <TableCell className='font-mono text-sm'>
                          {d.tipo_refe}-{d.no_refe}
                        </TableCell>
                        <TableCell className='text-sm'>
                          {fmtDate(d.fecha)}
                        </TableCell>
                        <TableCell className='max-w-56 truncate text-sm'>
                          {d.detalle}
                        </TableCell>
                        <TableCell className='text-right tabular-nums'>
                          RD$ {fmt(d.monto)}
                        </TableCell>
                        <TableCell className='text-right tabular-nums'>
                          RD$ {fmt(d.saldo)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(refsQ.data ?? []).length === 0 && !refsQ.isLoading && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className='py-4 text-center text-muted-foreground'
                        >
                          La solicitud no tiene documentos referenciados.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
