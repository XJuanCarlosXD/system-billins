import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCompany } from '@/context/company-context'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Companias as FatCompanias } from '@/features/fat/companias'
import { Companias as CntCompanias } from '@/features/cnt/companias'
import { CxcCias } from '@/features/cxc/cxc-catalogos'
import { CxpCias } from '@/features/cxp/cxp-catalogos'
import { OdcCias } from '@/features/odc/odc-cias'
import { CompaniasInv } from '@/features/inv/companias'
import { ChcCias } from '@/features/chc/chc-cias'
import { AccCias } from '@/features/acc/acc-cias'
import { SdnCias } from '@/features/sdn/sdn-simple-tables'
import { AcfCias } from '@/features/acf/acf-simple-tables'

// Mapa tab → queryKey base de ese módulo. Antes invalidabamos LOS 10 query
// keys en cada cambio de tab → network storm contra Oracle. Ahora solo
// invalidamos el query del tab al que estamos entrando.
const TAB_TO_QUERY_KEY: Record<string, string> = {
  fat: 'fat-companias',
  cxc: 'cxc-cias',
  cxp: 'cxp-cias',
  odc: 'odc-cias',
  inv: 'inv-companias',
  chc: 'chc-cias',
  acc: 'acc-cias',
  sdn: 'sdn-cias',
  acf: 'acf-cias',
  cnt: 'cnt-companias',
}

export function UnifiedCompanias() {
  const { selectedCompany } = useCompany()
  const qc = useQueryClient()
  const [active, setActive] = useState('fat')
  const noCia = selectedCompany ?? ''

  const onValueChange = (next: string) => {
    setActive(next)
    const k = TAB_TO_QUERY_KEY[next]
    if (k) qc.invalidateQueries({ queryKey: [k] })
  }

  return (
    <Tabs value={active} onValueChange={onValueChange} className='flex h-full flex-col'>
      <TabsList className='w-full justify-start overflow-x-auto'>
        <TabsTrigger value='fat'>Facturación</TabsTrigger>
        <TabsTrigger value='cxc'>Cuentas por Cobrar</TabsTrigger>
        <TabsTrigger value='cxp'>Cuentas por Pagar</TabsTrigger>
        <TabsTrigger value='odc'>Órdenes de Compra</TabsTrigger>
        <TabsTrigger value='inv'>Inventario</TabsTrigger>
        <TabsTrigger value='chc'>Bancos / Cheques</TabsTrigger>
        <TabsTrigger value='acc'>Caja Chica</TabsTrigger>
        <TabsTrigger value='sdn'>Nómina</TabsTrigger>
        <TabsTrigger value='acf'>Activos Fijos</TabsTrigger>
        <TabsTrigger value='cnt'>Contabilidad</TabsTrigger>
      </TabsList>
      <div className='mt-3 flex-1 overflow-auto'>
        {/* Render condicional por tab — antes los 10 TabsContent estaban
            en el DOM al mismo tiempo (Radix sin forceMount monta solo el
            activo pero el JSX igual era pesado de procesar). Asi solo
            evaluamos JSX del tab activo. */}
        {active === 'fat' && <TabsContent value='fat'><FatCompanias noCia={noCia} /></TabsContent>}
        {active === 'cxc' && <TabsContent value='cxc'><CxcCias noCia={noCia} /></TabsContent>}
        {active === 'cxp' && <TabsContent value='cxp'><CxpCias noCia={noCia} /></TabsContent>}
        {active === 'odc' && <TabsContent value='odc'><OdcCias /></TabsContent>}
        {active === 'inv' && <TabsContent value='inv'><CompaniasInv /></TabsContent>}
        {active === 'chc' && <TabsContent value='chc'><ChcCias /></TabsContent>}
        {active === 'acc' && <TabsContent value='acc'><AccCias /></TabsContent>}
        {active === 'sdn' && <TabsContent value='sdn'><SdnCias /></TabsContent>}
        {active === 'acf' && <TabsContent value='acf'><AcfCias /></TabsContent>}
        {active === 'cnt' && <TabsContent value='cnt'><CntCompanias noCia={noCia} /></TabsContent>}
      </div>
    </Tabs>
  )
}
