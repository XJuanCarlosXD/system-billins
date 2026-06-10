import { useMemo, useState } from 'react'
import {
  FileText,
  ImageIcon,
  Save,
  Receipt,
  ScrollText,
  ClipboardList,
  Banknote,
  Calculator,
  ShoppingCart,
  Coins,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

type DocType = {
  id: string
  label: string
  prefix: string
  icon: typeof FileText
  description: string
  /** Columnas del detalle visibles por defecto. */
  defaultColumns: string[]
  /** ¿Lleva NCF DGI compuesto en cabecera? */
  hasNcf: boolean
}

const docTypes: DocType[] = [
  {
    id: 'factura',
    label: 'Factura de venta',
    prefix: 'FT / FC',
    icon: Receipt,
    description:
      'Factura tipo F (contado) y C (crédito) emitida desde FAT — Nueva Factura.',
    defaultColumns: [
      'Código',
      'Descripción',
      'Cant.',
      'Precio',
      'Desc.',
      'ITBIS',
      'Total',
    ],
    hasNcf: true,
  },
  {
    id: 'cotizacion',
    label: 'Cotización',
    prefix: 'CT',
    icon: ScrollText,
    description: 'Cotización al cliente, sin afectar inventario.',
    defaultColumns: [
      'Código',
      'Descripción',
      'Cant.',
      'Precio',
      'Desc.',
      'Total',
    ],
    hasNcf: false,
  },
  {
    id: 'conduce',
    label: 'Conduce',
    prefix: 'CO',
    icon: ClipboardList,
    description:
      'Documento de despacho — afecta inventario pero no facturación.',
    defaultColumns: ['Código', 'Descripción', 'Cant.', 'UM'],
    hasNcf: false,
  },
  {
    id: 'orden-compra',
    label: 'Orden de Compra',
    prefix: 'ODC',
    icon: ShoppingCart,
    description: 'Orden al proveedor desde ODC.',
    defaultColumns: ['Código', 'Descripción', 'Cant.', 'Precio', 'Total'],
    hasNcf: false,
  },
  {
    id: 'cheque',
    label: 'Cheque',
    prefix: 'CH',
    icon: Banknote,
    description: 'Cheque impreso desde Bancos / Cheques.',
    defaultColumns: ['Concepto', 'Monto'],
    hasNcf: false,
  },
  {
    id: 'caja-chica',
    label: 'Egreso de Caja Chica',
    prefix: 'ACC',
    icon: Coins,
    description: 'Recibo de egreso menor para Caja Chica.',
    defaultColumns: ['Concepto', 'Cuenta', 'Monto'],
    hasNcf: false,
  },
  {
    id: 'asiento',
    label: 'Asiento contable',
    prefix: 'CNT',
    icon: Calculator,
    description: 'Comprobante de diario para Contabilidad.',
    defaultColumns: ['Cuenta', 'Centro', 'Débito', 'Crédito'],
    hasNcf: false,
  },
]

type Template = {
  logoUrl: string
  razonSocial: string
  rnc: string
  direccion: string
  telefono: string
  showLogo: boolean
  showRnc: boolean
  showNcf: boolean
  showFooter: boolean
  footerText: string
  primaryColor: string
  paperSize: 'LETTER' | 'A4'
  marginTop: number
  marginBottom: number
  columns: Record<string, boolean>
}

const defaultTemplate = (doc: DocType): Template => ({
  logoUrl: '',
  razonSocial: 'ABREGONZA, SRL',
  rnc: '131-12345-6',
  direccion: 'Av. Independencia 100, Santo Domingo, R.D.',
  telefono: '(809) 555-0000',
  showLogo: true,
  showRnc: true,
  showNcf: doc.hasNcf,
  showFooter: true,
  footerText:
    doc.id === 'factura'
      ? 'Esta factura está sujeta a las disposiciones de la Ley 11-92 y sus modificaciones.'
      : doc.id === 'cheque'
        ? 'Páguese a la orden del beneficiario indicado.'
        : 'Documento emitido por sistema. Original.',
  primaryColor: '#1f2937',
  paperSize: 'LETTER',
  marginTop: 18,
  marginBottom: 18,
  columns: Object.fromEntries(doc.defaultColumns.map((c) => [c, true])),
})

export function PdfTemplatesEditor() {
  const [activeId, setActiveId] = useState<string>(docTypes[0].id)
  const active = useMemo(
    () => docTypes.find((d) => d.id === activeId)!,
    [activeId]
  )
  const [templates, setTemplates] = useState<Record<string, Template>>(() =>
    Object.fromEntries(docTypes.map((d) => [d.id, defaultTemplate(d)]))
  )
  const tpl = templates[active.id]
  const update = (patch: Partial<Template>) =>
    setTemplates((prev) => ({
      ...prev,
      [active.id]: { ...prev[active.id], ...patch },
    }))
  const toggleCol = (col: string, on: boolean) =>
    setTemplates((prev) => ({
      ...prev,
      [active.id]: {
        ...prev[active.id],
        columns: { ...prev[active.id].columns, [col]: on },
      },
    }))

  const onSave = () => {
    toast.success(
      `Plantilla "${active.label}" guardada (mock — backend pendiente)`
    )
  }

  return (
    <div className='space-y-6'>
      <div>
        <h3 className='text-base font-semibold'>Plantillas PDF</h3>
        <p className='text-sm text-muted-foreground'>
          Personaliza cabecera, logo, columnas del detalle y leyenda fiscal para
          cada documento que el sistema imprime. Equivale a editar los reportes
          Oracle <i>Rfat / Rcxc / Rchc / Rcnt</i> sin tocar código.
          <span className='ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900'>
            Beta — Guardado mock, backend pendiente
          </span>
        </p>
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]'>
        <div className='space-y-1'>
          <Label className='text-xs tracking-wide text-muted-foreground uppercase'>
            Tipo de documento
          </Label>
          <div className='flex flex-col gap-1 rounded-md border bg-card p-1'>
            {docTypes.map((d) => {
              const Icon = d.icon
              const active = d.id === activeId
              return (
                <button
                  key={d.id}
                  onClick={() => setActiveId(d.id)}
                  className={`flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors ${
                    active
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <Icon className='h-4 w-4 text-muted-foreground' />
                  <span className='flex-1 truncate'>{d.label}</span>
                  <Badge variant='outline' className='font-mono text-[10px]'>
                    {d.prefix}
                  </Badge>
                </button>
              )
            })}
          </div>
        </div>

        <div className='space-y-4'>
          <Card>
            <CardHeader className='pb-3'>
              <div className='flex items-start justify-between'>
                <div>
                  <CardTitle className='text-base'>{active.label}</CardTitle>
                  <CardDescription className='mt-1'>
                    {active.description}
                  </CardDescription>
                </div>
                <Button onClick={onSave} size='sm'>
                  <Save className='mr-2 h-4 w-4' />
                  Guardar
                </Button>
              </div>
            </CardHeader>
            <CardContent className='space-y-6'>
              <section className='space-y-3'>
                <h4 className='text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
                  Cabecera de la empresa
                </h4>
                <div className='grid gap-3 sm:grid-cols-2'>
                  <div className='space-y-1'>
                    <Label htmlFor='razon'>Razón social</Label>
                    <Input
                      id='razon'
                      value={tpl.razonSocial}
                      onChange={(e) => update({ razonSocial: e.target.value })}
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label htmlFor='rnc'>RNC</Label>
                    <Input
                      id='rnc'
                      value={tpl.rnc}
                      onChange={(e) => update({ rnc: e.target.value })}
                    />
                  </div>
                  <div className='space-y-1 sm:col-span-2'>
                    <Label htmlFor='direccion'>Dirección</Label>
                    <Input
                      id='direccion'
                      value={tpl.direccion}
                      onChange={(e) => update({ direccion: e.target.value })}
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label htmlFor='telefono'>Teléfono</Label>
                    <Input
                      id='telefono'
                      value={tpl.telefono}
                      onChange={(e) => update({ telefono: e.target.value })}
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label htmlFor='logo'>URL del logo</Label>
                    <div className='flex items-center gap-2'>
                      <ImageIcon className='h-4 w-4 text-muted-foreground' />
                      <Input
                        id='logo'
                        placeholder='https://… o /assets/logo.png'
                        value={tpl.logoUrl}
                        onChange={(e) => update({ logoUrl: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className='flex flex-wrap gap-4 pt-1'>
                  <label className='flex items-center gap-2 text-sm'>
                    <Checkbox
                      checked={tpl.showLogo}
                      onCheckedChange={(v) => update({ showLogo: !!v })}
                    />
                    Mostrar logo
                  </label>
                  <label className='flex items-center gap-2 text-sm'>
                    <Checkbox
                      checked={tpl.showRnc}
                      onCheckedChange={(v) => update({ showRnc: !!v })}
                    />
                    Mostrar RNC
                  </label>
                  {active.hasNcf && (
                    <label className='flex items-center gap-2 text-sm'>
                      <Checkbox
                        checked={tpl.showNcf}
                        onCheckedChange={(v) => update({ showNcf: !!v })}
                      />
                      Mostrar NCF DGI compuesto
                    </label>
                  )}
                </div>
              </section>

              <Separator />

              <section className='space-y-3'>
                <h4 className='text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
                  Columnas del detalle
                </h4>
                <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4'>
                  {Object.entries(tpl.columns).map(([col, on]) => (
                    <label
                      key={col}
                      className='flex items-center gap-2 rounded-md border p-2 text-sm'
                    >
                      <Checkbox
                        checked={on}
                        onCheckedChange={(v) => toggleCol(col, !!v)}
                      />
                      <span className='truncate'>{col}</span>
                    </label>
                  ))}
                </div>
              </section>

              <Separator />

              <section className='space-y-3'>
                <h4 className='text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
                  Pie de página
                </h4>
                <label className='flex items-center gap-2 text-sm'>
                  <Checkbox
                    checked={tpl.showFooter}
                    onCheckedChange={(v) => update({ showFooter: !!v })}
                  />
                  Mostrar leyenda al pie
                </label>
                {tpl.showFooter && (
                  <Textarea
                    rows={3}
                    value={tpl.footerText}
                    onChange={(e) => update({ footerText: e.target.value })}
                  />
                )}
              </section>

              <Separator />

              <section className='space-y-3'>
                <h4 className='text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
                  Layout
                </h4>
                <div className='grid gap-3 sm:grid-cols-3'>
                  <div className='space-y-1'>
                    <Label>Tamaño de papel</Label>
                    <div className='flex gap-1 rounded-md border p-1'>
                      {(['LETTER', 'A4'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => update({ paperSize: s })}
                          className={`flex-1 rounded-sm px-2 py-1 text-xs ${
                            tpl.paperSize === s
                              ? 'bg-accent text-accent-foreground'
                              : 'hover:bg-muted'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className='space-y-1'>
                    <Label htmlFor='mt'>Margen superior (mm)</Label>
                    <Input
                      id='mt'
                      type='number'
                      min={0}
                      max={50}
                      value={tpl.marginTop}
                      onChange={(e) =>
                        update({ marginTop: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label htmlFor='mb'>Margen inferior (mm)</Label>
                    <Input
                      id='mb'
                      type='number'
                      min={0}
                      max={50}
                      value={tpl.marginBottom}
                      onChange={(e) =>
                        update({ marginBottom: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label htmlFor='color'>Color primario</Label>
                    <div className='flex items-center gap-2'>
                      <Input
                        id='color'
                        type='color'
                        value={tpl.primaryColor}
                        onChange={(e) =>
                          update({ primaryColor: e.target.value })
                        }
                        className='h-9 w-12 p-1'
                      />
                      <Input
                        value={tpl.primaryColor}
                        onChange={(e) =>
                          update({ primaryColor: e.target.value })
                        }
                        className='font-mono'
                      />
                    </div>
                  </div>
                </div>
              </section>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm'>Vista previa</CardTitle>
              <CardDescription>
                Representación simplificada de la cabecera y primeras líneas del
                PDF.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className='rounded-md border bg-background p-6 text-sm text-black shadow-sm'
                style={{ borderColor: tpl.primaryColor }}
              >
                <div
                  className='flex items-start gap-4 border-b pb-3'
                  style={{ borderColor: tpl.primaryColor }}
                >
                  {tpl.showLogo && (
                    <div className='flex h-14 w-14 items-center justify-center rounded border bg-muted/40 text-[10px] text-muted-foreground'>
                      {tpl.logoUrl ? (
                        <img
                          src={tpl.logoUrl}
                          alt='logo'
                          className='max-h-12 max-w-12 object-contain'
                        />
                      ) : (
                        'LOGO'
                      )}
                    </div>
                  )}
                  <div className='flex-1'>
                    <div
                      className='text-lg font-bold'
                      style={{ color: tpl.primaryColor }}
                    >
                      {tpl.razonSocial}
                    </div>
                    {tpl.showRnc && (
                      <div className='font-mono text-[11px]'>
                        RNC: {tpl.rnc}
                      </div>
                    )}
                    <div className='text-[11px]'>{tpl.direccion}</div>
                    <div className='text-[11px]'>Tel: {tpl.telefono}</div>
                  </div>
                  <div className='text-right'>
                    <div
                      className='text-base font-semibold uppercase'
                      style={{ color: tpl.primaryColor }}
                    >
                      {active.label}
                    </div>
                    <div className='font-mono text-[11px]'>
                      {active.prefix}-0000001
                    </div>
                    {active.hasNcf && tpl.showNcf && (
                      <div className='font-mono text-[11px]'>
                        NCF: E310000000001
                      </div>
                    )}
                    <div className='text-[11px]'>Fecha: 2026-06-09</div>
                  </div>
                </div>

                <table className='mt-4 w-full text-[11px]'>
                  <thead>
                    <tr
                      className='border-b text-left'
                      style={{ borderColor: tpl.primaryColor }}
                    >
                      {Object.entries(tpl.columns)
                        .filter(([, on]) => on)
                        .map(([c]) => (
                          <th key={c} className='py-1 pr-2'>
                            {c}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className='border-b'>
                      {Object.entries(tpl.columns)
                        .filter(([, on]) => on)
                        .map(([c]) => (
                          <td key={c} className='py-1 pr-2 tabular-nums'>
                            ···
                          </td>
                        ))}
                    </tr>
                  </tbody>
                </table>

                {tpl.showFooter && (
                  <div className='mt-6 text-center text-[10px] text-gray-600 italic'>
                    {tpl.footerText}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
