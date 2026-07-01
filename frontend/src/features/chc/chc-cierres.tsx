// CHC Cierres — cierre de conciliación bancaria con selector de cuenta + confirmación.
// Antes solo mostraba el histórico; ahora también ejecuta el cierre.
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Lock, CheckCircle2 } from 'lucide-react'
import { AlertIrreversible } from '@/components/cierre'
import { GuardedButton } from '@/components/access'

const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function ChcCierres() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const [confirm, setConfirm] = useState(false)
  const [cuenta, setCuenta] = useState('')
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())

  const cierresQ = useQuery({
    queryKey: ['chc-cierres', selectedCompany, selectedPoint],
    queryFn: () =>
      api.chcListCierres({ no_cia: selectedCompany!, punto: selectedPoint || undefined }),
    enabled: !!selectedCompany,
  })
  const cuentasQ = useQuery({
    queryKey: ['chc-cuentas-list', selectedCompany, selectedPoint],
    queryFn: () =>
      api.chcListCuentas({ no_cia: selectedCompany!, punto: selectedPoint || undefined, activa: 'S' }),
    enabled: !!selectedCompany,
  })

  const aplicar = useMutation({
    mutationFn: () =>
      api.chcCierreConciliacion({
        no_cia: selectedCompany!,
        punto: selectedPoint!,
        cuenta_banco: cuenta,
        ano,
        mes,
      }),
    onSuccess: () => {
      toast.success(`Conciliación ${MESES[mes]} ${ano} cerrada para cuenta ${cuenta}`)
      setConfirm(false)
      qc.invalidateQueries({ queryKey: ['chc-cierres'] })
    },
    onError: (e: any) =>
      toast.error(e?.detail?.error || e?.message || 'Error al cerrar conciliación'),
  })

  const cierres: any[] = (cierresQ.data as any[]) || []
  const cuentas: any[] = (cuentasQ.data as any[]) || []
  const yaCerrada = cierres.some(
    (c) => Number(c.ano) === ano && Number(c.mes) === mes && String(c.cuenta_banco) === String(cuenta),
  )

  return (
    <div className='p-6 space-y-4 max-w-4xl mx-auto'>
      <Card>
        <CardHeader className='pb-3'>
          <div className='flex items-center justify-between'>
            <CardTitle className='text-lg'>Cierre de Conciliación Bancaria</CardTitle>
            <Badge variant='outline'>
              Empresa {selectedCompany} · Punto {selectedPoint}
            </Badge>
          </div>
          <p className='text-xs text-muted-foreground mt-0.5'>
            Cierra la conciliación de una cuenta bancaria para un período.
          </p>
        </CardHeader>
        <CardContent className='space-y-4'>
          <AlertIrreversible tone='amber'>
            Una vez cerrada la conciliación, no se podrán modificar los movimientos
            del período para esa cuenta.
          </AlertIrreversible>

          <div className='grid grid-cols-3 gap-3'>
            <div className='space-y-1.5'>
              <Label className='text-xs'>Cuenta bancaria</Label>
              <Select value={cuenta} onValueChange={setCuenta}>
                <SelectTrigger className='h-9'>
                  <SelectValue placeholder='Seleccionar' />
                </SelectTrigger>
                <SelectContent>
                  {cuentas.map((c) => (
                    <SelectItem key={c.cuenta_banco} value={String(c.cuenta_banco)}>
                      {c.cuenta_banco} — {c.nombre_cuenta ?? c.nombre ?? c.descripcion ?? ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label className='text-xs'>Mes</Label>
              <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                <SelectTrigger className='h-9'><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.slice(1).map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label className='text-xs'>Año</Label>
              <Input
                type='number'
                min={2000}
                max={2099}
                value={ano}
                onChange={(e) => setAno(Number(e.target.value))}
                className='h-9'
              />
            </div>
          </div>

          {yaCerrada && (
            <div className='rounded border border-muted bg-muted/40 px-3 py-2 text-sm flex items-center gap-2'>
              <Lock className='h-4 w-4' /> Conciliación ya cerrada para esta cuenta/período.
            </div>
          )}

          <GuardedButton
            modulo="chc"
            flag="HACER_CIERRE"
            onClick={() => setConfirm(true)}
            disabled={!cuenta || !selectedPoint || yaCerrada}
            variant='destructive'
            className='w-full gap-2'
          >
            <Lock className='h-4 w-4' /> Cerrar Conciliación
          </GuardedButton>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Año</TableHead>
                <TableHead>Mes</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead>Fecha cierre</TableHead>
                <TableHead>Usuario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cierres.map((c, i) => (
                <TableRow key={`${c.ano}-${c.mes}-${c.cuenta_banco}-${i}`}>
                  <TableCell className='font-mono'>{c.ano}</TableCell>
                  <TableCell>
                    <Badge variant='outline'>{MESES[Number(c.mes)]}</Badge>
                  </TableCell>
                  <TableCell className='font-mono'>{c.cuenta_banco}</TableCell>
                  <TableCell>{c.fecha_sysdate ? String(c.fecha_sysdate).slice(0, 10) : ''}</TableCell>
                  <TableCell className='text-xs'>{c.usuario}</TableCell>
                </TableRow>
              ))}
              {cierres.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className='text-center text-muted-foreground py-6'>
                    Sin cierres registrados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <CheckCircle2 className='h-5 w-5 text-emerald-600' />
              Confirmar cierre {MESES[mes]} {ano}
            </DialogTitle>
          </DialogHeader>
          <p className='text-sm'>
            Cuenta: <b>{cuenta}</b>. Operación irreversible.
          </p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setConfirm(false)}>Cancelar</Button>
            <Button onClick={() => aplicar.mutate()} disabled={aplicar.isPending}>
              {aplicar.isPending ? 'Aplicando…' : 'Sí, cerrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
