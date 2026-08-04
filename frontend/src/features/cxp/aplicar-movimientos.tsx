// CxP — Aplicación de Movimientos (equivale a Fcxp206).
// Aplica un débito con saldo a favor (nota de débito, anticipo, pago)
// contra las facturas pendientes del mismo proveedor, dejando la
// trazabilidad en TCXP_REFEDOCU.
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Play } from 'lucide-react'
import { toast } from 'sonner'
import { regalGeneralApi as api } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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

// El usuario busca "8653" y espera encontrar el documento "0008653"
// (NO_DOCU es CHAR(7) con ceros a la izquierda) sin tener que escribir el
// padding completo — comparar ambos lados sin ceros a la izquierda.
const sinCerosIzq = (v: string) => v.replace(/^0+(?=\d)/, '')

interface P {
  noCia: string
  punto?: string
}

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export function CxpAplicarMovimientos({ noCia, punto = '' }: P) {
  const qc = useQueryClient()
  const [proveedor, setProveedor] = useState<any | null>(null)
  const [favor, setFavor] = useState<any | null>(null)
  const [montos, setMontos] = useState<Record<string, string>>({})
  const [confirmando, setConfirmando] = useState(false)
  const [buscarNoDocu, setBuscarNoDocu] = useState('')
  const [filtroTipoDocu, setFiltroTipoDocu] = useState('__all__')

  const q = useQuery({
    queryKey: [
      'cxp-aplicar-movimientos',
      noCia,
      punto,
      proveedor?.no_proveedor,
      favor?.tipo_docu,
      favor?.no_docu,
    ],
    queryFn: () =>
      api.cxpAplicarMovimientosGet({
        no_cia: noCia,
        punto,
        no_proveedor: proveedor.no_proveedor,
        tipo_docu: favor?.tipo_docu,
        no_docu: favor?.no_docu,
      }),
    enabled: !!noCia && !!punto && !!proveedor?.no_proveedor,
  })

  const aFavor = q.data?.a_favor || []
  const pendientes = q.data?.pendientes || []

  const tiposDocuDisponibles = useMemo(
    () => Array.from(new Set(pendientes.map((d: any) => d.tipo_docu))).sort(),
    [pendientes]
  )

  const pendientesFiltradas = useMemo(() => {
    const busq = sinCerosIzq(buscarNoDocu.trim())
    return pendientes.filter((d: any) => {
      if (filtroTipoDocu !== '__all__' && d.tipo_docu !== filtroTipoDocu) return false
      if (busq && !sinCerosIzq(String(d.no_docu || '')).includes(busq)) return false
      return true
    })
  }, [pendientes, buscarNoDocu, filtroTipoDocu])

  const disponible = favor ? Math.abs(Number(favor.saldo || 0)) : 0
  const totalAplicar = useMemo(
    () =>
      Object.values(montos).reduce((acc, v) => acc + (Number(v) || 0), 0),
    [montos]
  )
  const restante = disponible - totalAplicar

  const keyOf = (d: any) => `${d.tipo_docu}|${d.no_docu}`

  const setMonto = (d: any, v: string) =>
    setMontos((m) => ({ ...m, [keyOf(d)]: v }))

  const elegirFavor = (d: any) => {
    setFavor(d)
    setMontos({})
    setBuscarNoDocu('')
    setFiltroTipoDocu('__all__')
  }

  // Rellena el monto de una factura con lo menor entre su saldo y lo que
  // queda disponible del saldo a favor.
  const autoLlenar = (d: any) => {
    const yaEste = Number(montos[keyOf(d)] || 0)
    const disponibleSinEste = disponible - (totalAplicar - yaEste)
    const monto = Math.min(Number(d.saldo || 0), Math.max(disponibleSinEste, 0))
    setMonto(d, monto > 0 ? monto.toFixed(2) : '')
  }

  const aplicaciones = useMemo(
    () =>
      pendientes
        .map((d: any) => ({
          tipo_docu: d.tipo_docu,
          no_docu: d.no_docu,
          saldo: Number(d.saldo || 0),
          monto: Number(montos[keyOf(d)] || 0),
        }))
        .filter((a) => a.monto > 0),
    [pendientes, montos]
  )

  const errores = useMemo(() => {
    const errs: string[] = []
    for (const a of aplicaciones) {
      if (a.monto > a.saldo + 0.005)
        errs.push(
          `${a.tipo_docu}-${a.no_docu}: el monto (${fmt(a.monto)}) excede su saldo (${fmt(a.saldo)})`
        )
    }
    if (favor && totalAplicar > disponible + 0.005)
      errs.push(
        `El total a aplicar (${fmt(totalAplicar)}) excede el saldo a favor disponible (${fmt(disponible)})`
      )
    return errs
  }, [aplicaciones, favor, totalAplicar, disponible])

  const aplicar = useMutation({
    mutationFn: () =>
      api.cxpAplicarMovimientos({
        no_cia: noCia,
        punto,
        tipo_docu: favor.tipo_docu,
        no_docu: favor.no_docu,
        aplicaciones: aplicaciones.map(({ tipo_docu, no_docu, monto }) => ({
          tipo_docu,
          no_docu,
          monto,
        })),
      }),
    onSuccess: (r) => {
      toast.success(
        `${favor.tipo_docu}-${favor.no_docu} aplicado contra ${r.aplicaciones.length} documento(s). ` +
          `Saldo a favor restante: RD$ ${fmt(Math.abs(r.saldo_favor_restante))}`
      )
      setConfirmando(false)
      setFavor(null)
      setMontos({})
      qc.invalidateQueries({ queryKey: ['cxp-aplicar-movimientos'] })
    },
    onError: (e: any) => {
      setConfirmando(false)
      toast.error(e?.detail?.error || e?.message || 'No se pudo aplicar el movimiento')
    },
  })

  return (
    <div className='space-y-4 p-6'>
      <div>
        <h1 className='text-2xl font-semibold'>Aplicación de Movimientos</h1>
        <p className='text-sm text-muted-foreground'>
          Aplica un documento con saldo a favor (nota de débito, anticipo o
          pago) contra las facturas pendientes del proveedor. Equivale a la
          forma legacy <i>Fcxp206</i>; deja trazabilidad en{' '}
          <span className='font-mono'>TCXP_REFEDOCU</span>.
        </p>
      </div>

      <div className='grid grid-cols-1 gap-3 md:max-w-xl'>
        <ProveedorPicker value={proveedor} onChange={setProveedor} />
      </div>

      {!proveedor?.no_proveedor ? (
        <div className='rounded border py-10 text-center text-sm text-muted-foreground'>
          Busca un proveedor con la lupa para ver sus saldos a favor y facturas
          pendientes.
        </div>
      ) : q.isLoading ? (
        <Skeleton className='h-40 w-full' />
      ) : (
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm'>
                1 · Saldos a favor del proveedor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='overflow-x-auto rounded border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className='text-right'>Saldo a favor</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aFavor.map((d: any) => {
                      const activo =
                        favor?.tipo_docu === d.tipo_docu && favor?.no_docu === d.no_docu
                      return (
                        <TableRow
                          key={keyOf(d)}
                          className={activo ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''}
                        >
                          <TableCell className='font-mono'>
                            {d.tipo_docu}-{d.no_docu}
                          </TableCell>
                          <TableCell>{d.fecha}</TableCell>
                          <TableCell className='text-right font-mono tabular-nums'>
                            RD$ {fmt(Math.abs(d.saldo))}
                          </TableCell>
                          <TableCell className='text-right'>
                            {activo ? (
                              <Badge>
                                <CheckCircle2 className='mr-1 h-3 w-3' /> Elegido
                              </Badge>
                            ) : (
                              <Button size='sm' variant='outline' onClick={() => elegirFavor(d)}>
                                Elegir
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {aFavor.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className='py-6 text-center text-muted-foreground'>
                          {proveedor.nombre || proveedor.no_proveedor} no tiene
                          documentos con saldo a favor (débitos con saldo pendiente).
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm'>
                2 · Facturas pendientes a las que aplicar
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              {!favor ? (
                <div className='rounded border py-8 text-center text-sm text-muted-foreground'>
                  Elige primero el saldo a favor de la izquierda.
                </div>
              ) : (
                <>
                  <div className='flex flex-wrap items-center gap-x-4 gap-y-1 rounded border bg-muted/40 px-3 py-2 text-sm'>
                    <span>
                      Disponible:{' '}
                      <b className='font-mono tabular-nums'>RD$ {fmt(disponible)}</b>
                    </span>
                    <span>
                      A aplicar:{' '}
                      <b className='font-mono tabular-nums'>RD$ {fmt(totalAplicar)}</b>
                    </span>
                    <span className={restante < -0.005 ? 'text-destructive' : ''}>
                      Restante:{' '}
                      <b className='font-mono tabular-nums'>RD$ {fmt(restante)}</b>
                    </span>
                  </div>
                  {pendientes.length > 0 && (
                    <div className='flex flex-wrap items-end gap-2'>
                      <div className='min-w-0 flex-1 space-y-1'>
                        <label className='text-xs text-muted-foreground'>
                          Buscar por número
                        </label>
                        <Input
                          placeholder='Ej. 8653'
                          className='h-9'
                          value={buscarNoDocu}
                          onChange={(e) => setBuscarNoDocu(e.target.value)}
                        />
                      </div>
                      <div className='w-40 space-y-1'>
                        <label className='text-xs text-muted-foreground'>
                          Tipo de documento
                        </label>
                        <Select value={filtroTipoDocu} onValueChange={setFiltroTipoDocu}>
                          <SelectTrigger className='h-9 w-full'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='__all__'>Todos</SelectItem>
                            {tiposDocuDisponibles.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  <div className='overflow-x-auto rounded border'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Factura</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead className='text-right'>Saldo</TableHead>
                          <TableHead className='w-36 text-right'>Monto a aplicar</TableHead>
                          <TableHead className='w-28' />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendientesFiltradas.map((d: any) => (
                          <TableRow key={keyOf(d)}>
                            <TableCell className='font-mono'>
                              {d.tipo_docu}-{d.no_docu}
                            </TableCell>
                            <TableCell>{d.fecha}</TableCell>
                            <TableCell className='text-right font-mono tabular-nums'>
                              RD$ {fmt(d.saldo)}
                            </TableCell>
                            <TableCell>
                              <Input
                                type='number'
                                step='0.01'
                                min='0'
                                className='h-9 text-right font-mono'
                                placeholder='0.00'
                                value={montos[keyOf(d)] || ''}
                                onChange={(e) => setMonto(d, e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                size='sm'
                                variant='outline'
                                className='h-9 w-full'
                                title='Selecciona esta factura y pone su saldo pendiente en el monto a aplicar'
                                onClick={() => autoLlenar(d)}
                              >
                                Seleccionar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {pendientes.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className='py-6 text-center text-muted-foreground'>
                              No hay facturas pendientes (créditos con saldo, sin
                              bloqueo de pago) para este proveedor.
                            </TableCell>
                          </TableRow>
                        )}
                        {pendientes.length > 0 && pendientesFiltradas.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className='py-6 text-center text-muted-foreground'>
                              Ninguna factura pendiente coincide con el filtro.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {errores.length > 0 && (
                    <div className='space-y-1 rounded border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive'>
                      {errores.map((e) => (
                        <div key={e}>{e}</div>
                      ))}
                    </div>
                  )}
                  <div className='flex justify-end'>
                    <Button
                      onClick={() => setConfirmando(true)}
                      disabled={aplicaciones.length === 0 || errores.length > 0 || aplicar.isPending}
                    >
                      <Play className='mr-2 h-4 w-4' /> Aplicar Movimiento
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={confirmando} onOpenChange={(o) => !aplicar.isPending && setConfirmando(o)}>
        <DialogContent className='h-auto max-h-[80vh] max-w-md overflow-y-auto sm:max-h-[80vh]'>
          <DialogHeader>
            <DialogTitle>Confirmar aplicación</DialogTitle>
          </DialogHeader>
          {favor && (
            <div className='space-y-3 text-sm'>
              <p>
                Se aplicará <b className='font-mono'>{favor.tipo_docu}-{favor.no_docu}</b>{' '}
                de <b>{proveedor?.nombre}</b> contra:
              </p>
              <div className='overflow-x-auto rounded border'>
                <Table>
                  <TableBody>
                    {aplicaciones.map((a) => (
                      <TableRow key={`${a.tipo_docu}-${a.no_docu}`}>
                        <TableCell className='font-mono'>
                          {a.tipo_docu}-{a.no_docu}
                        </TableCell>
                        <TableCell className='text-right font-mono tabular-nums'>
                          RD$ {fmt(a.monto)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className='font-semibold'>Total</TableCell>
                      <TableCell className='text-right font-mono font-semibold tabular-nums'>
                        RD$ {fmt(totalAplicar)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <p className='text-xs text-muted-foreground'>
                Los saldos de las facturas se reducirán y quedará el registro de
                la aplicación. Esta operación afecta los saldos del proveedor.
              </p>
              <div className='flex justify-end gap-2'>
                <Button variant='outline' onClick={() => setConfirmando(false)} disabled={aplicar.isPending}>
                  Cancelar
                </Button>
                <Button onClick={() => aplicar.mutate()} disabled={aplicar.isPending}>
                  {aplicar.isPending ? 'Aplicando…' : 'Confirmar y Aplicar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
