import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { Receipt } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCompany } from '@/context/company-context'

import { Facturas } from './facturas'
import { TiposDocumentoFat } from './tdocu'
import { CondicionesPago } from './condiciones-pago'
import { ControlNcf } from './ncf-fat'
import { Companias } from './companias'
import { PuntosTrabajoFat } from './puntos'
import { TiposPagoFat } from './tipos-pago'
import { ListasPrecioFat } from './listas-precio'
import { TransportistasFat } from './transportistas'
import { NotasFat } from './notas'
import { ConducesFat } from './conduces'
import { CuadreCajaFat } from './cuadre-caja'
import { RepVentasProducto } from './rep-ventas'
import { RepVentasVendedor } from './fat-rep-ventas-vendedor'
import { RepVentasCliente } from './fat-rep-ventas-cliente'
import { RepAnaliticaVentas } from './fat-rep-analitica'
import { RepNcf607 } from './rep-607'
import { RepNcfNulos } from './rep-ncf-nulos'
import { CierreMensualFat } from './cierre-mensual'
import { GenerarAsientosFat } from './generar-asientos'
import { NuevaFactura } from './fat-nueva-factura'
import { NuevoConduce } from './fat-nuevo-conduce'
import { AnularFactura } from './fat-anular-factura'

const route = getRouteApi('/_authenticated/fat')

const MESES = [
  { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' }, { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' }, { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' },
]

const NOW = new Date()
const CURRENT_YEAR = NOW.getFullYear()
const CURRENT_MONTH = NOW.getMonth() + 1
const YEARS = [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

const VIEWS_WITH_DATE = new Set([
  'facturas', 'conduces', 'cuadre-caja',
  'rep-ventas', 'rep-607', 'rep-ncf-nulos',
  'generar-asientos', 'cierre-mensual',
  'rep-ventas-vendedor', 'rep-ventas-cliente',
])

function DateFilter({ ano, mes, onAno, onMes }: {
  ano: number; mes: number
  onAno: (v: number) => void; onMes: (v: number) => void
}) {
  return (
    <div className='flex items-center gap-2 mb-4'>
      <Select value={String(ano)} onValueChange={(v) => onAno(Number(v))}>
        <SelectTrigger className='h-8 w-24'><SelectValue /></SelectTrigger>
        <SelectContent>
          {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={String(mes)} onValueChange={(v) => onMes(Number(v))}>
        <SelectTrigger className='h-8 w-32'><SelectValue /></SelectTrigger>
        <SelectContent>
          {MESES.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

export function FatPage() {
  const search = route.useSearch()
  const { selectedCompany, selectedPoint } = useCompany()
  const [ano, setAno] = useState(CURRENT_YEAR)
  const [mes, setMes] = useState(CURRENT_MONTH)

  const view = (search as any).view ?? 'facturas'
  const noCia = selectedCompany ?? ''
  const punto = selectedPoint ?? ''
  const needsDate = VIEWS_WITH_DATE.has(view)

  return (
    <>
      <Header>
        <div className='me-auto flex items-center gap-2'>
          <Receipt className='h-5 w-5 shrink-0' />
          <h2 className='text-lg font-semibold'>Facturacion (FAT)</h2>
        </div>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main fluid className='px-4 py-4'>
        <div key={`${view}-${noCia}-${punto}-${ano}-${mes}`} className='py-2'>
          {needsDate && (
            <DateFilter ano={ano} mes={mes} onAno={setAno} onMes={setMes} />
          )}
          {renderView(view, { noCia, punto, ano, mes })}
        </div>
      </Main>
    </>
  )
}

function renderView(view: string, ctx: { noCia: string; punto: string; ano: number; mes: number }) {
  switch (view) {
    case 'anular-factura':
      return <AnularFactura noCia={ctx.noCia} punto={ctx.punto} />
    case 'nueva-factura':
      return <NuevaFactura noCia={ctx.noCia} punto={ctx.punto} />
    case 'nuevo-conduce':
      return <NuevoConduce noCia={ctx.noCia} punto={ctx.punto} />
    case 'facturas':
      return <Facturas noCia={ctx.noCia} punto={ctx.punto} mes={ctx.mes} ano={ctx.ano} />
    case 'conduces':
      return <ConducesFat noCia={ctx.noCia} punto={ctx.punto} mes={ctx.mes} ano={ctx.ano} />
    case 'cuadre-caja':
      return <CuadreCajaFat noCia={ctx.noCia} punto={ctx.punto} mes={ctx.mes} ano={ctx.ano} />
    case 'rep-ventas':
      return <RepVentasProducto noCia={ctx.noCia} punto={ctx.punto} />
    case 'rep-607':
      return <RepNcf607 noCia={ctx.noCia} punto={ctx.punto} />
    case 'rep-ncf-nulos':
      return <RepNcfNulos noCia={ctx.noCia} punto={ctx.punto} />
    case 'rep-ventas-vendedor':
      return <RepVentasVendedor noCia={ctx.noCia} punto={ctx.punto} mes={ctx.mes} ano={ctx.ano} />
    case 'rep-ventas-cliente':
      return <RepVentasCliente noCia={ctx.noCia} punto={ctx.punto} mes={ctx.mes} ano={ctx.ano} />
    case 'rep-analitica':
      return <RepAnaliticaVentas noCia={ctx.noCia} punto={ctx.punto} ano={ctx.ano} />
    case 'generar-asientos':
      return <GenerarAsientosFat noCia={ctx.noCia} punto={ctx.punto} mes={ctx.mes} ano={ctx.ano} />
    case 'cierre-mensual':
      return <CierreMensualFat noCia={ctx.noCia} punto={ctx.punto} mes={ctx.mes} ano={ctx.ano} />
    case 'companias':
      return <Companias noCia={ctx.noCia} />
    case 'puntos':
      return <PuntosTrabajoFat noCia={ctx.noCia} />
    case 'tdocu':
      return <TiposDocumentoFat noCia={ctx.noCia} punto={ctx.punto} />
    case 'condiciones':
      return <CondicionesPago noCia={ctx.noCia} punto={ctx.punto} />
    case 'tipos-pago':
      return <TiposPagoFat noCia={ctx.noCia} punto={ctx.punto} />
    case 'listas-precio':
      return <ListasPrecioFat noCia={ctx.noCia} punto={ctx.punto} />
    case 'transportistas':
      return <TransportistasFat />
    case 'notas':
      return <NotasFat />
    case 'ncf':
      return <ControlNcf noCia={ctx.noCia} punto={ctx.punto} mes={ctx.mes} ano={ctx.ano} />
    default:
      return <Facturas noCia={ctx.noCia} punto={ctx.punto} mes={ctx.mes} ano={ctx.ano} />
  }
}

export const FatModule = FatPage
