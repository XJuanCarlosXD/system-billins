// Configuración de Facturación Electrónica (e-CF DGII, Ley 32-23) por empresa
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useCompany } from '@/context/company-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AMBIENTES_FE,
  ESTADOS_CERT,
  TIPOS_ECF,
  useFeConfig,
  useFeSecuencias,
  useProbarConexion,
  useSaveFeConfig,
  useSaveFeSecuencia,
  useUploadCertificado,
} from '@/features/fe/api'

function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null
  const ms = new Date(fecha + 'T00:00:00').getTime() - Date.now()
  return Math.floor(ms / 86400000)
}

export function UnifiedFacturacionElectronica() {
  const { selectedCompany } = useCompany()
  const noCia = selectedCompany ?? ''
  const { data, isLoading } = useFeConfig(noCia)
  const cfg = data?.config ?? null

  const [form, setForm] = useState({
    ambiente: 'testecf',
    rnc_emisor: '',
    razon_social: '',
    nombre_comercial: '',
    direccion_emisor: '',
    estado_cert: 'NO_INICIADO',
    activo: 'N',
  })
  useEffect(() => {
    if (cfg) {
      setForm({
        ambiente: cfg.ambiente || 'testecf',
        rnc_emisor: cfg.rnc_emisor || '',
        razon_social: cfg.razon_social || '',
        nombre_comercial: cfg.nombre_comercial || '',
        direccion_emisor: cfg.direccion_emisor || '',
        estado_cert: cfg.estado_cert || 'NO_INICIADO',
        activo: cfg.activo || 'N',
      })
    } else {
      setForm((f) => ({ ...f, rnc_emisor: '', razon_social: '' }))
    }
  }, [cfg?.no_cia, cfg?.fecha_actualiza])

  const saveConfig = useSaveFeConfig(noCia)
  const probar = useProbarConexion(noCia)
  const upload = useUploadCertificado(noCia)

  const [certFile, setCertFile] = useState<File | null>(null)
  const [certPass, setCertPass] = useState('')

  const guardar = () => {
    if (!form.rnc_emisor.trim() || !form.razon_social.trim()) {
      toast.error('RNC y razón social del emisor son requeridos')
      return
    }
    saveConfig.mutate(form as any, {
      onSuccess: () => toast.success('Configuración guardada'),
      onError: (e: any) => toast.error(e.message),
    })
  }

  const probarConexion = () => {
    probar.mutate(undefined, {
      onSuccess: (r) =>
        r.ok
          ? toast.success(r.mensaje)
          : toast.error(r.mensaje || 'Falló la conexión'),
      onError: (e: any) => toast.error(e.message),
    })
  }

  const subirCertificado = () => {
    if (!certFile || !certPass) {
      toast.error('Seleccione el archivo .p12/.pfx y digite la contraseña')
      return
    }
    upload.mutate(
      { file: certFile, password: certPass },
      {
        onSuccess: (r) => {
          toast.success(`Certificado cargado — vence ${r.cert_vence}`)
          setCertFile(null)
          setCertPass('')
        },
        onError: (e: any) => toast.error(e.message),
      }
    )
  }

  if (!noCia) {
    return (
      <p className='text-muted-foreground text-sm'>
        Seleccione una empresa para configurar la facturación electrónica.
      </p>
    )
  }
  if (isLoading) {
    return (
      <div className='space-y-3'>
        <Skeleton className='h-24 w-full' />
        <Skeleton className='h-40 w-full' />
      </div>
    )
  }

  const diasCert = diasHasta(cfg?.cert_vence ?? null)

  return (
    <div className='grid gap-4 pb-8 lg:grid-cols-2'>
      {/* Estado */}
      <Card className='lg:col-span-2'>
        <CardHeader className='pb-2'>
          <CardTitle className='flex flex-wrap items-center gap-2 text-base'>
            Estado — Empresa {noCia}
            <Badge
              variant={
                form.estado_cert === 'CERTIFICADO' ? 'default' : 'secondary'
              }
            >
              {ESTADOS_CERT[form.estado_cert] ?? form.estado_cert}
            </Badge>
            <Badge variant='outline'>{AMBIENTES_FE[form.ambiente]}</Badge>
          </CardTitle>
          <CardDescription>
            Comprobantes Fiscales Electrónicos (e-CF) según la Ley 32-23 de la
            DGII.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-wrap items-center gap-6'>
          <div className='flex items-center gap-2'>
            <Switch
              id='fe-activo'
              checked={form.activo === 'S'}
              onCheckedChange={(v) =>
                setForm({ ...form, activo: v ? 'S' : 'N' })
              }
            />
            <Label htmlFor='fe-activo'>Emisión electrónica activa</Label>
          </div>
          {cfg?.tiene_cert === 'S' && diasCert !== null && diasCert < 30 && (
            <Badge variant='destructive'>
              {diasCert < 0
                ? 'Certificado vencido'
                : `Certificado vence en ${diasCert} días`}
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Datos del emisor + ambiente */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>Datos del emisor</CardTitle>
          <CardDescription>
            Deben coincidir con el registro del RNC en la DGII.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <Label>RNC emisor</Label>
              <Input
                value={form.rnc_emisor}
                maxLength={11}
                onChange={(e) =>
                  setForm({ ...form, rnc_emisor: e.target.value.trim() })
                }
              />
            </div>
            <div>
              <Label>Ambiente DGII</Label>
              <Select
                value={form.ambiente}
                onValueChange={(v) => setForm({ ...form, ambiente: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AMBIENTES_FE).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Razón social</Label>
            <Input
              value={form.razon_social}
              maxLength={150}
              onChange={(e) =>
                setForm({ ...form, razon_social: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Nombre comercial</Label>
            <Input
              value={form.nombre_comercial}
              maxLength={150}
              onChange={(e) =>
                setForm({ ...form, nombre_comercial: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Dirección</Label>
            <Input
              value={form.direccion_emisor}
              maxLength={250}
              onChange={(e) =>
                setForm({ ...form, direccion_emisor: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Estado del proceso de certificación</Label>
            <Select
              value={form.estado_cert}
              onValueChange={(v) => setForm({ ...form, estado_cert: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ESTADOS_CERT).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={guardar} disabled={saveConfig.isPending}>
            {saveConfig.isPending ? 'Guardando…' : 'Guardar configuración'}
          </Button>
        </CardContent>
      </Card>

      {/* Certificado + conexión */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>
            Certificado digital y conexión
          </CardTitle>
          <CardDescription>
            Certificado .p12/.pfx de una certificadora aprobada por INDOTEL
            (propósito Procedimientos Tributarios).
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          {cfg?.tiene_cert === 'S' ? (
            <div className='rounded-md border p-3 text-sm'>
              <p className='font-medium'>Certificado cargado</p>
              <p className='text-muted-foreground break-all'>
                {cfg.cert_subject}
              </p>
              <p className='text-muted-foreground'>
                Vence: {cfg.cert_vence ?? '—'}
              </p>
            </div>
          ) : (
            <p className='text-muted-foreground text-sm'>
              Esta empresa aún no tiene certificado digital cargado.
            </p>
          )}
          <div>
            <Label>Archivo del certificado (.p12 / .pfx)</Label>
            <Input
              type='file'
              accept='.p12,.pfx'
              onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <Label>Contraseña del certificado</Label>
            <Input
              type='password'
              value={certPass}
              onChange={(e) => setCertPass(e.target.value)}
            />
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button
              variant='secondary'
              onClick={subirCertificado}
              disabled={upload.isPending}
            >
              {upload.isPending ? 'Subiendo…' : 'Subir certificado'}
            </Button>
            <Button
              onClick={probarConexion}
              disabled={probar.isPending || !cfg}
            >
              {probar.isPending ? 'Probando…' : 'Probar conexión con la DGII'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Secuencias e-NCF */}
      <SecuenciasCard noCia={noCia} />
    </div>
  )
}

function SecuenciasCard({ noCia }: { noCia: string }) {
  const { data, isLoading } = useFeSecuencias(noCia)
  const save = useSaveFeSecuencia(noCia)
  const [open, setOpen] = useState(false)
  const [nuevo, setNuevo] = useState({
    tipo_ecf: '31',
    secuencia_desde: '',
    secuencia_hasta: '',
    prox_secuencia: '',
    fecha_vence: '',
  })

  const registrar = () => {
    const desde = Number(nuevo.secuencia_desde)
    const hasta = Number(nuevo.secuencia_hasta)
    const prox = Number(nuevo.prox_secuencia || nuevo.secuencia_desde)
    if (!desde || !hasta || !nuevo.fecha_vence) {
      toast.error('Complete desde, hasta y fecha de vencimiento')
      return
    }
    save.mutate(
      {
        tipo_ecf: nuevo.tipo_ecf,
        secuencia_desde: desde,
        secuencia_hasta: hasta,
        prox_secuencia: prox,
        fecha_vence: nuevo.fecha_vence,
        activa: 'S',
      },
      {
        onSuccess: () => {
          toast.success('Rango e-NCF registrado')
          setOpen(false)
          setNuevo({
            tipo_ecf: '31',
            secuencia_desde: '',
            secuencia_hasta: '',
            prox_secuencia: '',
            fecha_vence: '',
          })
        },
        onError: (e: any) => toast.error(e.message),
      }
    )
  }

  return (
    <Card className='lg:col-span-2'>
      <CardHeader className='flex-row items-center justify-between pb-2'>
        <div>
          <CardTitle className='text-base'>Secuencias e-NCF</CardTitle>
          <CardDescription>
            Rangos autorizados por la DGII (se solicitan en la Oficina
            Virtual). El e-NCF tiene 13 caracteres: E + tipo + secuencia.
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size='sm'>Registrar rango</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar rango e-NCF</DialogTitle>
            </DialogHeader>
            <div className='space-y-3'>
              <div>
                <Label>Tipo de e-CF</Label>
                <Select
                  value={nuevo.tipo_ecf}
                  onValueChange={(v) => setNuevo({ ...nuevo, tipo_ecf: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPOS_ECF).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {k} — {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='grid grid-cols-3 gap-3'>
                <div>
                  <Label>Desde</Label>
                  <Input
                    type='number'
                    min={1}
                    value={nuevo.secuencia_desde}
                    onChange={(e) =>
                      setNuevo({ ...nuevo, secuencia_desde: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Hasta</Label>
                  <Input
                    type='number'
                    min={1}
                    value={nuevo.secuencia_hasta}
                    onChange={(e) =>
                      setNuevo({ ...nuevo, secuencia_hasta: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Próxima</Label>
                  <Input
                    type='number'
                    min={1}
                    placeholder='= desde'
                    value={nuevo.prox_secuencia}
                    onChange={(e) =>
                      setNuevo({ ...nuevo, prox_secuencia: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Vence</Label>
                <Input
                  type='date'
                  value={nuevo.fecha_vence}
                  onChange={(e) =>
                    setNuevo({ ...nuevo, fecha_vence: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={registrar} disabled={save.isPending}>
                {save.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className='h-20 w-full' />
        ) : !data?.items?.length ? (
          <p className='text-muted-foreground text-sm'>
            No hay secuencias e-NCF registradas para esta empresa.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead className='text-right'>Desde</TableHead>
                <TableHead className='text-right'>Hasta</TableHead>
                <TableHead className='text-right'>Próxima</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead>Activa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((s) => (
                <TableRow key={`${s.tipo_ecf}-${s.secuencia_desde}`}>
                  <TableCell>
                    {s.tipo_ecf} — {TIPOS_ECF[s.tipo_ecf] ?? ''}
                  </TableCell>
                  <TableCell className='text-right'>
                    {s.secuencia_desde}
                  </TableCell>
                  <TableCell className='text-right'>
                    {s.secuencia_hasta}
                  </TableCell>
                  <TableCell className='text-right'>
                    {s.prox_secuencia}
                  </TableCell>
                  <TableCell>{s.fecha_vence}</TableCell>
                  <TableCell>
                    <Badge variant={s.activa === 'S' ? 'default' : 'secondary'}>
                      {s.activa === 'S' ? 'Sí' : 'No'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
