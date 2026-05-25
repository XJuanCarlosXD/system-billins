import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useFacturaForm } from '@/hooks/use-fat-facturas'
import { FATFactura, FATFacturaL } from '@/services/fat-api'

interface FATFacturaFormProps {
  factura?: FATFactura | null
  onBack: () => void
}

export function FATFacturaForm({ factura, onBack }: FATFacturaFormProps) {
  const form = useFacturaForm()
  const [paso, setPaso] = useState(1)

  useEffect(() => {
    if (factura) {
      form.setFactura({
        ...factura,
        lineas: factura.lineas || [],
      })
    }
  }, [factura])

  const handleAgregarLinea = () => {
    const nuevaLinea: Partial<FATFacturaL> = {
      no_produ: '',
      descripcion: '',
      almacen: '01',
      cantidad: 0,
      precio: 0,
      costo: 0,
      porc_descuento: 0,
      porciento_impuesto: 18,
      cantidad_regalia: 0,
      empaque: 1,
      st_anulado: 'N',
    }
    form.agregarLinea(nuevaLinea)
  }

  const handleActualizarLinea = (noLinea: number, datos: Partial<FATFacturaL>) => {
    form.editarLinea(noLinea, datos)
    form.calcularTotales()
  }

  const handleGuardar = async () => {
    if (!form.factura) {
      toast.error('Datos de factura incompletos')
      return
    }

    const resultado = await form.guardarFactura(form.factura)
    if (resultado) {
      toast.success('Factura guardada correctamente')
      onBack()
    }
  }

  return (
    <>
      <Header>
        <Button variant='ghost' size='sm' onClick={onBack} className='me-2'>
          <ArrowLeft className='h-4 w-4' />
        </Button>
        <h2 className='text-lg font-semibold me-auto'>
          {factura ? 'Editar Factura' : 'Nueva Factura'}
        </h2>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main fluid>
        {/* Indicador de pasos */}
        <div className='mb-6 flex gap-2'>
          {[1, 2, 3, 4].map((p) => (
            <button
              key={p}
              onClick={() => setPaso(p)}
              className={`flex-1 py-2 px-4 rounded text-sm font-medium ${
                paso === p
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              Paso {p}
            </button>
          ))}
        </div>

        {/* Paso 1: Datos del Cliente */}
        {paso === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Seleccionar Cliente</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <Label>Cliente *</Label>
                  <Input
                    type='number'
                    placeholder='No. Cliente'
                    value={form.factura?.no_cliente || ''}
                    onChange={(e) =>
                      form.setFactura({
                        ...form.factura,
                        no_cliente: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Tipo Factura *</Label>
                  <select
                    className='h-10 w-full px-3 border rounded bg-background'
                    value={form.factura?.tipo_factura || ''}
                    onChange={(e) =>
                      form.setFactura({
                        ...form.factura,
                        tipo_factura: e.target.value,
                      })
                    }
                  >
                    <option value=''>Seleccionar...</option>
                    <option value='FT'>Factura Fiscal</option>
                    <option value='FC'>Factura Consumidor</option>
                  </select>
                </div>
              </div>

              <div className='flex gap-2 pt-4'>
                <Button
                  onClick={() => setPaso(2)}
                  disabled={!form.factura?.no_cliente || !form.factura?.tipo_factura}
                >
                  Siguiente
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Paso 2: Datos de Encabezado */}
        {paso === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Datos del Encabezado</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid grid-cols-3 gap-4'>
                <div>
                  <Label>Fecha *</Label>
                  <Input
                    type='date'
                    value={form.factura?.fecha || ''}
                    onChange={(e) =>
                      form.setFactura({
                        ...form.factura,
                        fecha: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Vendedor</Label>
                  <Input
                    placeholder='Código vendedor'
                    value={form.factura?.vendedor || ''}
                    onChange={(e) =>
                      form.setFactura({
                        ...form.factura,
                        vendedor: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Forma de Pago *</Label>
                  <select
                    className='h-10 w-full px-3 border rounded bg-background'
                    value={form.factura?.forma_pago || ''}
                    onChange={(e) =>
                      form.setFactura({
                        ...form.factura,
                        forma_pago: e.target.value,
                      })
                    }
                  >
                    <option value=''>Seleccionar...</option>
                    <option value='Contado'>Contado</option>
                    <option value='Crédito'>Crédito</option>
                  </select>
                </div>
              </div>

              <div className='grid grid-cols-3 gap-4'>
                <div>
                  <Label>Plazo (días)</Label>
                  <Input
                    type='number'
                    value={form.factura?.plazo_pago || 0}
                    onChange={(e) =>
                      form.setFactura({
                        ...form.factura,
                        plazo_pago: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Tasa USD</Label>
                  <Input
                    type='number'
                    step='0.01'
                    value={form.factura?.tasa_us || 1}
                    onChange={(e) =>
                      form.setFactura({
                        ...form.factura,
                        tasa_us: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>% Impuesto</Label>
                  <Input
                    type='number'
                    step='0.01'
                    value={form.factura?.porc_impuesto || 18}
                    onChange={(e) =>
                      form.setFactura({
                        ...form.factura,
                        porc_impuesto: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className='flex gap-2 pt-4'>
                <Button variant='outline' onClick={() => setPaso(1)}>
                  Anterior
                </Button>
                <Button
                  onClick={() => setPaso(3)}
                  disabled={!form.factura?.fecha || !form.factura?.forma_pago}
                >
                  Siguiente
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Paso 3: Líneas */}
        {paso === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center justify-between'>
                <span>Líneas de Factura</span>
                <Button
                  size='sm'
                  onClick={handleAgregarLinea}
                >
                  <Plus className='h-4 w-4 mr-2' /> Agregar Línea
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {form.lineas.length === 0 ? (
                <p className='text-center text-muted-foreground py-8'>
                  No hay líneas. Haz clic en "Agregar Línea" para comenzar.
                </p>
              ) : (
                <div className='space-y-3 overflow-x-auto'>
                  {form.lineas.map((linea) => (
                    <div
                      key={linea.no_linea}
                      className='p-3 border rounded-lg space-y-3'
                    >
                      <div className='grid grid-cols-5 gap-3'>
                        <Input
                          placeholder='Producto'
                          value={linea.no_produ || ''}
                          onChange={(e) =>
                            handleActualizarLinea(linea.no_linea!, {
                              ...linea,
                              no_produ: e.target.value,
                            })
                          }
                        />
                        <Input
                          placeholder='Descripción'
                          value={linea.descripcion || ''}
                          onChange={(e) =>
                            handleActualizarLinea(linea.no_linea!, {
                              ...linea,
                              descripcion: e.target.value,
                            })
                          }
                        />
                        <Input
                          type='number'
                          placeholder='Cantidad'
                          step='0.01'
                          value={linea.cantidad || ''}
                          onChange={(e) =>
                            handleActualizarLinea(linea.no_linea!, {
                              ...linea,
                              cantidad: parseFloat(e.target.value),
                            })
                          }
                        />
                        <Input
                          type='number'
                          placeholder='Precio'
                          step='0.01'
                          value={linea.precio || ''}
                          onChange={(e) =>
                            handleActualizarLinea(linea.no_linea!, {
                              ...linea,
                              precio: parseFloat(e.target.value),
                            })
                          }
                        />
                        <Button
                          size='sm'
                          variant='destructive'
                          onClick={() => form.eliminarLinea(linea.no_linea!)}
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>

                      <div className='grid grid-cols-5 gap-3 text-sm'>
                        <Input
                          type='number'
                          placeholder='% Desc'
                          step='0.01'
                          value={linea.porc_descuento || 0}
                          onChange={(e) =>
                            handleActualizarLinea(linea.no_linea!, {
                              ...linea,
                              porc_descuento: parseFloat(e.target.value),
                            })
                          }
                        />
                        <Input
                          type='number'
                          placeholder='% Impuesto'
                          step='0.01'
                          value={linea.porciento_impuesto || 18}
                          onChange={(e) =>
                            handleActualizarLinea(linea.no_linea!, {
                              ...linea,
                              porciento_impuesto: parseFloat(e.target.value),
                            })
                          }
                        />
                        <Input placeholder='Almacén' disabled value={linea.almacen} />
                        <div className='col-span-2 text-right pt-2'>
                          <span className='text-muted-foreground'>
                            Subtotal:{' '}
                            {((linea.cantidad || 0) * (linea.precio || 0)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className='flex gap-2 pt-4'>
                <Button variant='outline' onClick={() => setPaso(2)}>
                  Anterior
                </Button>
                <Button
                  onClick={() => {
                    form.calcularTotales()
                    setPaso(4)
                  }}
                  disabled={form.lineas.length === 0}
                >
                  Siguiente
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Paso 4: Resumen */}
        {paso === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Resumen de Factura</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid grid-cols-2 gap-4 p-3 bg-muted rounded'>
                <div>
                  <p className='text-sm text-muted-foreground'>No. Cliente</p>
                  <p className='font-semibold'>{form.factura?.no_cliente}</p>
                </div>
                <div>
                  <p className='text-sm text-muted-foreground'>Fecha</p>
                  <p className='font-semibold'>{form.factura?.fecha}</p>
                </div>
                <div>
                  <p className='text-sm text-muted-foreground'>Tipo</p>
                  <p className='font-semibold'>{form.factura?.tipo_factura}</p>
                </div>
                <div>
                  <p className='text-sm text-muted-foreground'>Forma Pago</p>
                  <p className='font-semibold'>{form.factura?.forma_pago}</p>
                </div>
              </div>

              <div className='border-t pt-4 space-y-2'>
                <div className='flex justify-between'>
                  <span>Total Línea:</span>
                  <span className='font-mono'>
                    {form.factura?.total_linea?.toFixed(2) || '0.00'}
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span>Descuento:</span>
                  <span className='font-mono'>
                    -{form.factura?.descuento?.toFixed(2) || '0.00'}
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span>Impuesto (18%):</span>
                  <span className='font-mono'>
                    {form.factura?.impuesto?.toFixed(2) || '0.00'}
                  </span>
                </div>
                <div className='border-t pt-2 flex justify-between text-lg font-bold'>
                  <span>Total Neto:</span>
                  <span className='font-mono'>
                    {form.factura?.total_neto?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>

              <div className='flex gap-2 pt-4'>
                <Button variant='outline' onClick={() => setPaso(3)}>
                  Anterior
                </Button>
                <Button
                  onClick={handleGuardar}
                  disabled={form.loading}
                >
                  {form.loading && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
                  {factura ? 'Actualizar' : 'Crear'} Factura
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </Main>
    </>
  )
}
