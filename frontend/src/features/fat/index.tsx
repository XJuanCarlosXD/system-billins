import { useEffect, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import {
  ReceiptText,
  FileText,
  ClipboardList,
  FileChartColumn,
  Settings,
  Gavel,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type SectionKey = 'configuracion' | 'operacion' | 'consultas' | 'reportes' | 'administracion'
type ViewKey =
  | 'tdocu'
  | 'condiciones'
  | 'listas-precio'
  | 'crear-factura'
  | 'conduces'
  | 'devoluciones'
  | 'listar-facturas'
  | 'busqueda-avanzada'
  | 'ventas-periodo'
  | 'reporte-607'
  | 'cuadre-caja'
  | 'control-ncf'
  | 'integraciones'

type Action = {
  key: ViewKey
  label: string
  legacy: string
  status: 'ready' | 'planned'
  summary: string
  icon: typeof ReceiptText
}

const route = getRouteApi('/_authenticated/fat')

const sectionMeta: Record<SectionKey, { label: string; icon: typeof ReceiptText }> = {
  configuracion: { label: 'Configuración', icon: Settings },
  operacion: { label: 'Operación', icon: ReceiptText },
  consultas: { label: 'Consultas', icon: ClipboardList },
  reportes: { label: 'Reportes', icon: FileChartColumn },
  administracion: { label: 'Administración', icon: Gavel },
}

const actionsBySection: Record<SectionKey, Action[]> = {
  configuracion: [
    {
      key: 'tdocu',
      label: 'Tipos de documento',
      legacy: 'Mant. Tipos de Factura',
      status: 'planned',
      summary: 'Crear y editar tipos de factura (FT, FC, etc.) con NCF asociados.',
      icon: FileText,
    },
    {
      key: 'condiciones',
      label: 'Condiciones de pago',
      legacy: 'Catalogo Condiciones Pago',
      status: 'planned',
      summary: 'Mantener catálogo de plazos de pago y condiciones.',
      icon: Settings,
    },
    {
      key: 'listas-precio',
      label: 'Listas de precio',
      legacy: 'Listas de Precios por Cliente',
      status: 'planned',
      summary: 'Precios específicos por cliente y lista.',
      icon: FileText,
    },
  ],
  operacion: [
    {
      key: 'crear-factura',
      label: 'Crear factura',
      legacy: 'Factura Vendedor',
      status: 'ready',
      summary: 'Crear facturas de contado o crédito con líneas de detalle.',
      icon: ReceiptText,
    },
    {
      key: 'conduces',
      label: 'Conducés',
      legacy: 'Conduce',
      status: 'planned',
      summary: 'Pre-facturas que se pueden convertir en facturas.',
      icon: FileText,
    },
    {
      key: 'devoluciones',
      label: 'Devoluciones',
      legacy: 'Devolución Vendedor',
      status: 'planned',
      summary: 'Procesar devoluciones y crear notas de crédito.',
      icon: ReceiptText,
    },
  ],
  consultas: [
    {
      key: 'listar-facturas',
      label: 'Listar facturas',
      legacy: 'Consulta Factura',
      status: 'ready',
      summary: 'Consultar todas las facturas con filtros por estado, período, vendedor.',
      icon: ClipboardList,
    },
    {
      key: 'busqueda-avanzada',
      label: 'Búsqueda avanzada',
      legacy: 'Busqueda Factura',
      status: 'planned',
      summary: 'Búsqueda por rango de fechas, monto, cliente, NCF.',
      icon: ClipboardList,
    },
  ],
  reportes: [
    {
      key: 'ventas-periodo',
      label: 'Ventas por período',
      legacy: 'Reporte Ventas',
      status: 'ready',
      summary: 'Totales de ventas por período, vendedor, cliente.',
      icon: FileChartColumn,
    },
    {
      key: 'reporte-607',
      label: 'Reporte 607 (DGII)',
      legacy: 'Reporte 607',
      status: 'planned',
      summary: 'Generador de reporte 607 para Dirección General de Impuestos Internos.',
      icon: FileChartColumn,
    },
    {
      key: 'cuadre-caja',
      label: 'Cuadre de caja',
      legacy: 'Cuadre de Caja',
      status: 'planned',
      summary: 'Reconciliación de ventas vs. ingresos en caja.',
      icon: FileChartColumn,
    },
  ],
  administracion: [
    {
      key: 'control-ncf',
      label: 'Control de NCF',
      legacy: 'Mant. NCF Facturacion',
      status: 'planned',
      summary: 'Gestión de secuencias NCF, alertas por vencimiento.',
      icon: Gavel,
    },
    {
      key: 'integraciones',
      label: 'Integraciones',
      legacy: 'Parametrizacion Integraciones',
      status: 'planned',
      summary: 'Sincronizar con CXC, INV, CNT y e-CF.',
      icon: Settings,
    },
  ],
}

export function FatPage() {
  const search = route.useSearch()
  const [section, setSection] = useState<SectionKey>(search.section || 'operacion')
  const [selectedView, setSelectedView] = useState<ViewKey | null>(
    search.view ? (search.view as ViewKey) : null
  )

  useEffect(() => {
    if (search.section) {
      setSection(search.section as SectionKey)
    }
    if (search.view) {
      setSelectedView(search.view as ViewKey)
    }
  }, [search])

  const actions = actionsBySection[section] || []
  const sectionInfo = sectionMeta[section]

  return (
    <>
      <Header>
        <h2 className='text-lg font-semibold me-auto flex items-center gap-2'>
          <ReceiptText className='h-5 w-5' /> Facturación (FAT)
        </h2>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main>
        <div className='space-y-4'>
          {/* Secciones */}
          <div className='flex gap-2 overflow-x-auto'>
            <ScrollArea className='w-full whitespace-nowrap'>
              <div className='flex gap-2 p-1'>
                {(Object.entries(sectionMeta) as [SectionKey, typeof sectionMeta[SectionKey]][]).map(
                  ([key, meta]) => (
                    <Button
                      key={key}
                      variant={section === key ? 'default' : 'outline'}
                      size='sm'
                      onClick={() => {
                        setSection(key)
                        setSelectedView(null)
                      }}
                      className='flex items-center gap-2'
                    >
                      <meta.icon className='h-4 w-4' />
                      {meta.label}
                    </Button>
                  )
                )}
              </div>
              <ScrollBar orientation='horizontal' />
            </ScrollArea>
          </div>

          {/* Grid de acciones */}
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {actions.map((action) => (
              <Card
                key={action.key}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  action.status === 'planned' ? 'opacity-60' : ''
                }`}
                onClick={() => {
                  if (action.status === 'ready') {
                    setSelectedView(action.key)
                  }
                }}
              >
                <CardHeader>
                  <div className='flex items-start justify-between'>
                    <div className='flex items-center gap-2'>
                      <action.icon className='h-5 w-5 text-primary' />
                      <CardTitle className='text-base'>{action.label}</CardTitle>
                    </div>
                    {action.status === 'planned' && (
                      <Badge variant='secondary' className='text-xs'>
                        Próximamente
                      </Badge>
                    )}
                    {action.status === 'ready' && (
                      <Badge variant='default' className='text-xs'>
                        Disponible
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className='text-sm text-muted-foreground mb-3'>{action.summary}</p>
                  {action.status === 'ready' && (
                    <p className='text-xs text-muted-foreground italic'>
                      Del legacy: <strong>{action.legacy}</strong>
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Vista seleccionada */}
          {selectedView === 'crear-factura' && (
            <Card className='mt-6'>
              <CardHeader>
                <CardTitle>Crear Factura</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='bg-muted p-8 rounded-lg text-center'>
                  <ReceiptText className='h-12 w-12 mx-auto mb-4 text-muted-foreground' />
                  <p className='text-muted-foreground mb-4'>
                    Módulo de creación de facturas con líneas editables
                  </p>
                  <Button>Nueva Factura</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedView === 'listar-facturas' && (
            <Card className='mt-6'>
              <CardHeader>
                <CardTitle>Listar Facturas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='bg-muted p-8 rounded-lg text-center'>
                  <ClipboardList className='h-12 w-12 mx-auto mb-4 text-muted-foreground' />
                  <p className='text-muted-foreground mb-4'>
                    Tabla de facturas con filtros y búsqueda avanzada
                  </p>
                  <Button>Ver Facturas</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedView === 'ventas-periodo' && (
            <Card className='mt-6'>
              <CardHeader>
                <CardTitle>Reporte de Ventas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='bg-muted p-8 rounded-lg text-center'>
                  <FileChartColumn className='h-12 w-12 mx-auto mb-4 text-muted-foreground' />
                  <p className='text-muted-foreground mb-4'>
                    Reportes de ventas por período, vendedor y cliente
                  </p>
                  <Button>Generar Reporte</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </Main>
    </>
  )
}
