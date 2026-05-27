import { useEffect, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import {
  BookOpenText,
  ClipboardCheck,
  FileChartColumn,
  Landmark,
  ReceiptText,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCompany } from '@/context/company-context'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { AsientosList } from './asientos'
import { BalanceComprobacion } from './balance'
import { CatalogoCuentas } from './catalogo'
import { CentrosCosto } from './centros-costo'
import { MayorCuenta } from './mayor'
import { NcfContabilidad } from './ncf'
import { PeriodosFiscales } from './periodos'
import { Companias } from './companias'
import { Sucursales } from './sucursales'
import { TiposCuenta } from './tipos-cuenta'
import { CatalogoSucursal } from './catalogo-sucursal'
import { GruposSucursal } from './grupos-sucursal'
import { PresupuestoAnual } from './presupuesto'
import { EstadoResultados } from './estado-resultados'
import { AutorizarMes } from './autorizar-mes'
import { AutorizarMesAnterior } from './autorizar-mes-anterior'
import { VerificarAsientos } from './verificar-asientos'
import { CierreMensual } from './cierre-mensual'

type SectionKey = 'configuracion' | 'procesos' | 'consultas' | 'reportes' | 'cierres'
type ViewKey =
  | 'catalogo'
  | 'centros'
  | 'ncf'
  | 'periodos'
  | 'companias'
  | 'sucursales'
  | 'tipos-cuenta'
  | 'catalogo-sucursal'
  | 'grupos-sucursal'
  | 'asientos'
  | 'verificacion'
  | 'autorizar'
  | 'autorizar-anterior'
  | 'presupuesto'
  | 'consulta-asientos'
  | 'movimientos'
  | 'balance'
  | 'mayor'
  | 'estados'
  | 'cierres'
  | 'cierre-mensual'

type Action = {
  key: ViewKey
  label: string
  legacy: string
  status: 'ready' | 'planned'
  summary: string
  tables: string[]
  apis: string[]
}

type PeriodMeta = {
  puntos?: Array<Record<string, any>>
  cierres?: Array<Record<string, any>>
  years?: number[]
  rangos?: Record<string, Record<string, any>>
}

const route = getRouteApi('/_authenticated/cnt')

const sectionMeta: Record<SectionKey, { label: string; icon: typeof BookOpenText }> = {
  configuracion: { label: 'Configuracion', icon: Landmark },
  procesos: { label: 'Procesos', icon: ReceiptText },
  consultas: { label: 'Consultas', icon: ClipboardCheck },
  reportes: { label: 'Reportes', icon: FileChartColumn },
  cierres: { label: 'Cierres', icon: BookOpenText },
}

const actionsBySection: Record<SectionKey, Action[]> = {
  configuracion: [
    {
      key: 'catalogo',
      label: 'Catalogo de cuentas',
      legacy: 'Cuentas del Catalogo',
      status: 'ready',
      summary: 'Alta, filtro y mantenimiento de cuentas contables.',
      tables: ['CNT.TCNT_CATALOGO', 'CNT.TCNT_TCUENTA'],
      apis: ['GET/POST/PATCH /api/cnt/catalogo/', 'GET /api/cnt/tcuenta/'],
    },
    {
      key: 'centros',
      label: 'Centros de costo',
      legacy: 'Catalogo Centro de Costos',
      status: 'ready',
      summary: 'Consulta, alta y exportacion del catalogo global de centros.',
      tables: ['CNT.TCNT_CENTRO_COSTO'],
      apis: ['GET/POST /api/cnt/centros-costo/'],
    },
    {
      key: 'ncf',
      label: 'Mantenimiento NCF',
      legacy: 'Mantenimiento NCF',
      status: 'ready',
      summary: 'Secuencias globales, alertas, creacion y edicion.',
      tables: ['CNT.TCNT_NCF'],
      apis: ['GET/POST /api/cnt/ncf/', 'PATCH /api/cnt/ncf/<codigo>/'],
    },
    {
      key: 'periodos',
      label: 'Periodos y cierres',
      legacy: 'Puntos de Trabajo o Sucursales / Cierres',
      status: 'ready',
      summary: 'Proceso activo, cierres y rangos reales de anos disponibles.',
      tables: ['CNT.TCNT_PUNTO', 'CNT.TCNT_CIERRE', 'CNT.TCNT_HCUENTA', 'CNT.TCNT_ASIENTO'],
      apis: ['GET /api/cnt/config/', 'GET /api/cnt/periodos/'],
    },
    {
      key: 'companias',
      label: 'Companias',
      legacy: 'Companias',
      status: 'ready',
      summary: 'Alta y mantenimiento de empresas.',
      tables: ['CNT.TCNT_CIA'],
      apis: ['GET/POST/PATCH /api/cnt/companias/'],
    },
    {
      key: 'sucursales',
      label: 'Sucursales',
      legacy: 'Puntos de Trabajo o Sucursales',
      status: 'ready',
      summary: 'Configuracion de puntos de trabajo / sucursales.',
      tables: ['CNT.TCNT_PUNTO'],
      apis: ['GET/POST/PATCH /api/cnt/sucursales/'],
    },
    {
      key: 'tipos-cuenta',
      label: 'Tipos de cuenta',
      legacy: 'Tipo de Cuenta',
      status: 'ready',
      summary: 'Clasificacion de cuentas (activo, pasivo, patrimonio, ingresos, gastos).',
      tables: ['CNT.TCNT_TCUENTA'],
      apis: ['GET/POST/PATCH /api/cnt/tcuenta/'],
    },
    {
      key: 'catalogo-sucursal',
      label: 'Asignar cuenta a sucursal',
      legacy: 'Asignar Cuenta a Sucursal',
      status: 'ready',
      summary: 'Relacion cuenta-sucursal.',
      tables: ['CNT.TCNT_CATALOGO', 'CNT.TCNT_PUNTO'],
      apis: ['GET/POST /api/cnt/catalogo-sucursal/'],
    },
    {
      key: 'grupos-sucursal',
      label: 'Grupo contable sucursal',
      legacy: 'Grupo Contable Sucursal',
      status: 'ready',
      summary: 'Agrupacion contable por punto.',
      tables: ['CNT.TCNT_GRUPO'],
      apis: ['GET/POST /api/cnt/grupos-sucursal/'],
    },
  ],
  procesos: [
    {
      key: 'asientos',
      label: 'Entrada de diario',
      legacy: 'Entrada de Diario',
      status: 'ready',
      summary: 'Captura, aprobacion, actualizacion, anulacion y busqueda de asientos.',
      tables: ['CNT.TCNT_ASIENTO', 'CNT.TCNT_ASIENTOL', 'CNT.TCNT_MOVIMIENTO', 'CNT.TCNT_HCUENTA'],
      apis: ['GET/POST /api/cnt/asientos/', 'POST /aprobar/', 'POST /actualizar/', 'POST /anular/'],
    },
    {
      key: 'verificacion',
      label: 'Verificacion de asientos',
      legacy: 'Rep. Verificacion De Asientos',
      status: 'ready',
      summary: 'Control de cuadre y consistencia antes de autorizar.',
      tables: ['CNT.TCNT_ASIENTO', 'CNT.TCNT_ASIENTOL'],
      apis: ['GET /api/cnt/asientos/?...'],
    },
    {
      key: 'autorizar',
      label: 'Autorizar asientos',
      legacy: 'Autorizar Asientos',
      status: 'ready',
      summary: 'Aprobar asientos del mes para que pasen a libro.',
      tables: ['CNT.TCNT_ASIENTO'],
      apis: ['POST /api/cnt/asientos/aprobar/'],
    },
    {
      key: 'autorizar-anterior',
      label: 'Procesos meses anteriores',
      legacy: 'Procesos Meses Anteriores',
      status: 'ready',
      summary: 'Permitir entrada/autorizacion en meses ya cerrados.',
      tables: ['CNT.TCNT_ASIENTO', 'CNT.TCNT_CIERRE'],
      apis: ['POST /api/cnt/asientos/aprobar/'],
    },
    {
      key: 'presupuesto',
      label: 'Presupuesto',
      legacy: 'Presupuesto',
      status: 'ready',
      summary: 'Manejo de presupuestos contables anuales.',
      tables: ['CNT.TCNT_PRESUPUESTO'],
      apis: ['GET/POST /api/cnt/presupuesto/'],
    },
  ],
  consultas: [
    {
      key: 'consulta-asientos',
      label: 'Consulta de asientos',
      legacy: 'Consulta de Asiento',
      status: 'ready',
      summary: 'Consulta global con filtro por texto, estados y paginacion.',
      tables: ['CNT.TCNT_ASIENTO', 'CNT.TCNT_ASIENTOL'],
      apis: ['GET /api/cnt/asientos/', 'GET /api/cnt/asientos/<no>/'],
    },
    {
      key: 'movimientos',
      label: 'Movimientos de cuentas',
      legacy: 'Consulta Movimientos de Cuentas',
      status: 'ready',
      summary: 'Consulta por cuenta con rango de meses y paginacion local.',
      tables: ['CNT.TCNT_MOVIMIENTO', 'CNT.TCNT_HCUENTA'],
      apis: ['GET /api/cnt/mayor/'],
    },
  ],
  reportes: [
    {
      key: 'balance',
      label: 'Balance de comprobacion',
      legacy: 'Balance de Comprob./Balance Situacion',
      status: 'ready',
      summary: 'Reporte base con salida en pantalla, PDF y Excel.',
      tables: ['CNT.TCNT_HCUENTA', 'CNT.TCNT_CATALOGO'],
      apis: ['GET /api/cnt/balance/'],
    },
    {
      key: 'mayor',
      label: 'Mayor general',
      legacy: 'Mayor General',
      status: 'ready',
      summary: 'Mayor por cuenta con rango de meses y exportacion.',
      tables: ['CNT.TCNT_MOVIMIENTO', 'CNT.TCNT_CATALOGO'],
      apis: ['GET /api/cnt/mayor/'],
    },
    {
      key: 'estados',
      label: 'Estados financieros',
      legacy: 'Estados Financieros, Anexos y Presupuesto',
      status: 'ready',
      summary: 'Balance general, estado de resultados y anexos.',
      tables: ['CNT.TCNT_CUENTAS_EF', 'CNT.TCNT_ENCABEZADO_EF', 'CNT.TCNT_LINEAS_EF'],
      apis: ['GET /api/cnt/reportes/<reporte>/pdf', 'GET /api/cnt/reportes/<reporte>/xlsx'],
    },
  ],
  cierres: [
    {
      key: 'cierres',
      label: 'Cierres contables',
      legacy: 'Cierre Mensual / Cierre Anual',
      status: 'ready',
      summary: 'Seguimiento del historial y estado de cierre del punto activo.',
      tables: ['CNT.TCNT_CIERRE', 'CNT.TCNT_PUNTO'],
      apis: ['GET /api/cnt/periodos/'],
    },
    {
      key: 'cierre-mensual',
      label: 'Cierre mensual',
      legacy: 'Cierre Mensual',
      status: 'ready',
      summary: 'Ejecuta el cierre del periodo mensual del punto activo.',
      tables: ['CNT.TCNT_CIERRE', 'CNT.TCNT_PUNTO'],
      apis: ['POST /api/cnt/cierre-mensual/'],
    },
  ],
}

const monthOptions = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
]

function getAction(section: SectionKey, key: ViewKey) {
  return actionsBySection[section].find((action) => action.key === key) ?? actionsBySection[section][0]
}

function sectionFromAction(key: ViewKey): SectionKey {
  const match = (Object.keys(actionsBySection) as SectionKey[]).find((section) =>
    actionsBySection[section].some((action) => action.key === key),
  )
  return match ?? 'reportes'
}

export function CntPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { selectedCompany, selectedPoint, setSelectedPoint } = useCompany()
  const [activeView, setActiveView] = useState<ViewKey>((search.view as ViewKey) || 'balance')
  const [config, setConfig] = useState<{ cia?: Record<string, any>; puntos?: Array<Record<string, any>> } | null>(null)
  const [periodMeta, setPeriodMeta] = useState<PeriodMeta | null>(null)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const activeSection = search.section as SectionKey

  useEffect(() => {
    if (!selectedCompany) return
    Promise.all([
      regalGeneralApi.cntConfig(selectedCompany),
      regalGeneralApi.cntPeriodos(selectedCompany),
    ])
      .then(([configData, periodData]) => {
        setConfig(configData)
        setPeriodMeta(periodData)
        const point = configData.puntos?.find((item) => item.punto === selectedPoint) ?? configData.puntos?.[0]
        if (point) {
          if (point.punto !== selectedPoint) {
            setSelectedPoint(point.punto)
          }
          setAno(Number(point.ano_proceso || new Date().getFullYear()))
          setMes(Number(point.mes_proceso || new Date().getMonth() + 1))
        }
      })
      .catch(() => {
        setConfig(null)
        setPeriodMeta(null)
      })
  }, [selectedCompany, selectedPoint, setSelectedPoint])

  const point = config?.puntos?.find((item) => item.punto === selectedPoint) ?? config?.puntos?.[0]
  const availableYears = periodMeta?.years?.length ? periodMeta.years : [ano]
  const currentAction = getAction(activeSection, activeView)
  const SectionIcon = sectionMeta[activeSection].icon

  useEffect(() => {
    if (!availableYears.length) return
    if (!availableYears.includes(ano)) {
      setAno(availableYears[0])
    }
  }, [availableYears, ano])

  // Deep-link from the sidebar: keep the active tab in sync with ?view=.
  useEffect(() => {
    if (search.view) setActiveView(search.view as ViewKey)
  }, [search.view])

  useEffect(() => {
    const sectionActions = actionsBySection[activeSection]
    if (!sectionActions.some((action) => action.key === activeView)) {
      setActiveView(sectionActions[0].key)
    }
  }, [activeSection, activeView])

  const openView = (view: ViewKey) => {
    const nextSection = sectionFromAction(view)
    navigate({
      search: (prev) => ({ ...prev, section: nextSection, view }),
      replace: true,
    })
    setActiveView(view)
  }

  return (
    <>
      <Header>
        <div className='me-auto flex min-w-0 flex-wrap items-center gap-3'>
          <div>
            <h2 className='flex items-center gap-2 text-lg font-semibold'>
              <Landmark className='h-5 w-5' />
              Contabilidad General
            </h2>
            <p className='text-sm text-muted-foreground'>Paridad funcional con el legado, sin duplicar selectores globales.</p>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <div>
              <Select value={String(ano)} onValueChange={(value) => setAno(Number(value))}>
                <SelectTrigger className='h-9 w-28'><SelectValue placeholder='Ano' /></SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={String(mes)} onValueChange={(value) => setMes(Number(value))}>
                <SelectTrigger className='h-9 w-36'><SelectValue placeholder='Mes' /></SelectTrigger>
                <SelectContent>
                  {monthOptions.map((item) => <SelectItem key={item.value} value={String(item.value)}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main fluid className='px-4 py-4'>
        <section className='space-y-4'>
          <div className='rounded-xl border bg-card p-4'>
              <div className='mb-3 flex flex-wrap items-start justify-between gap-3'>
                <div className='space-y-1'>
                  <div className='flex items-center gap-2'>
                    <SectionIcon className='h-4 w-4 text-muted-foreground' />
                    <span className='text-sm font-medium text-muted-foreground'>{sectionMeta[activeSection].label}</span>
                  <Badge variant='outline'>{point?.punto || selectedPoint}</Badge>
                </div>
                <h3 className='text-lg font-semibold'>{currentAction.label}</h3>
                <p className='text-sm text-muted-foreground'>{currentAction.summary}</p>
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                  <Badge variant='outline'>{currentAction.legacy}</Badge>
                  <Badge variant={currentAction.status === 'ready' ? 'outline' : 'secondary'}>
                    {currentAction.status === 'ready' ? 'Operativo' : 'Planificado'}
                  </Badge>
              </div>
            </div>
            <ScrollArea>
              <div className='flex gap-2 pb-1'>
                {actionsBySection[activeSection].map((action) => (
                  <Button
                    key={action.key}
                    variant={activeView === action.key ? 'default' : 'outline'}
                    className='justify-start'
                    onClick={() => openView(action.key)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
              <ScrollBar orientation='horizontal' />
            </ScrollArea>
          </div>

          <div
            key={`${activeView}-${selectedCompany}-${point?.punto || selectedPoint}-${ano}-${mes}`}
            className='rounded-xl border bg-card p-6'
          >
            {renderWorkspace(activeView, {
              noCia: selectedCompany,
              punto: point?.punto || selectedPoint,
              ano,
              mes,
              action: currentAction,
            })}
          </div>
        </section>
      </Main>
    </>
  )
}

function renderWorkspace(
  view: ViewKey,
  context: {
    noCia: string
    punto: string
    ano: number
    mes: number
    action: Action
  },
) {
  switch (view) {
    case 'catalogo':
      return <CatalogoCuentas noCia={context.noCia} punto={context.punto} ano={context.ano} mes={context.mes} />
    case 'centros':
      return <CentrosCosto noCia={context.noCia} punto={context.punto} ano={context.ano} mes={context.mes} />
    case 'ncf':
      return <NcfContabilidad noCia={context.noCia} punto={context.punto} ano={context.ano} mes={context.mes} />
    case 'periodos':
    case 'cierres':
      return <PeriodosFiscales noCia={context.noCia} punto={context.punto} ano={context.ano} mes={context.mes} />
    case 'asientos':
      return <AsientosList noCia={context.noCia} punto={context.punto} ano={context.ano} mes={context.mes} />
    case 'consulta-asientos':
      return <AsientosList noCia={context.noCia} punto={context.punto} ano={context.ano} mes={context.mes} mode='query' />
    case 'balance':
      return <BalanceComprobacion noCia={context.noCia} punto={context.punto} ano={context.ano} mes={context.mes} />
    case 'mayor':
    case 'movimientos':
      return <MayorCuenta noCia={context.noCia} punto={context.punto} ano={context.ano} mes={context.mes} />
    case 'companias':
      return <Companias noCia={context.noCia} />
    case 'sucursales':
      return <Sucursales noCia={context.noCia} punto={context.punto} />
    case 'tipos-cuenta':
      return <TiposCuenta />
    case 'catalogo-sucursal':
      return <CatalogoSucursal noCia={context.noCia} punto={context.punto} />
    case 'grupos-sucursal':
      return <GruposSucursal noCia={context.noCia} punto={context.punto} />
    case 'verificacion':
      return <VerificarAsientos noCia={context.noCia} punto={context.punto} ano={context.ano} mes={context.mes} />
    case 'autorizar':
      return <AutorizarMes noCia={context.noCia} punto={context.punto} ano={context.ano} mes={context.mes} />
    case 'autorizar-anterior':
      return <AutorizarMesAnterior noCia={context.noCia} punto={context.punto} ano={context.ano} mes={context.mes} />
    case 'presupuesto':
      return <PresupuestoAnual noCia={context.noCia} punto={context.punto} ano={context.ano} />
    case 'estados':
      return <EstadoResultados noCia={context.noCia} punto={context.punto} ano={context.ano} mes={context.mes} />
    case 'cierre-mensual':
      return <CierreMensual noCia={context.noCia} punto={context.punto} />
    default:
      return <PlannedWorkspace action={context.action} />
  }
}

function PlannedWorkspace({ action }: { action: Action }) {
  return (
    <div className='space-y-5'>
      <div className='rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground'>
        Esta capacidad queda inventariada y pendiente del siguiente tramo, pero ya usa el mismo contexto global de empresa, punto y periodo.
      </div>
      <div className='grid gap-5 lg:grid-cols-2'>
        <div className='space-y-2'>
          <h4 className='font-medium'>Tablas a validar</h4>
          <ul className='space-y-1 text-sm text-muted-foreground'>
            {action.tables.map((table) => <li key={table}>{table}</li>)}
          </ul>
        </div>
        <div className='space-y-2'>
          <h4 className='font-medium'>Rutas objetivo</h4>
          <ul className='space-y-1 text-sm text-muted-foreground'>
            {action.apis.map((api) => <li key={api}>{api}</li>)}
          </ul>
        </div>
      </div>
    </div>
  )
}

export const CntModule = CntPage
